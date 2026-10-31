<script lang="ts">
  import { pb } from './lib/pb';
  import { store } from './lib/store.svelte';
  import { ensurePushSubscription, syncNotification } from './lib/notify';
  import { isNative, Sleep } from './lib/native';
  import { checkForUpdates } from './lib/ota';
  import Login from './components/Login.svelte';
  import Home from './components/Home.svelte';
  import History from './components/History.svelte';
  import Stats from './components/Stats.svelte';
  import Icon from './components/Icon.svelte';

  let authed = $state(pb.authStore.isValid);
  let tab = $state<'now' | 'history' | 'stats'>('now');
  /** Native only: don't overwrite widget state before cache, server and pending widget actions are merged. */
  let nativeReady = $state(false);
  /** Native only: a new APK is needed for the latest version. */
  let apkUrl = $state<string | null>(null);
  let lastUpdateCheck = 0;
  let apkStatus = $state('');

  async function installUpdate() {
    if (!apkUrl || apkStatus.startsWith('Lädt')) return;
    apkStatus = 'Lädt…';
    const progress = await Sleep.addListener('apkProgress', (e) => {
      if (e.percent >= 0) apkStatus = `Lädt… ${e.percent}%`;
    });
    try {
      const { status } = await Sleep.installApk({ url: apkUrl });
      apkStatus = status === 'permission' ? 'Bitte „Apps installieren“ erlauben und dann nochmal tippen' : '';
    } catch {
      apkStatus = 'Download fehlgeschlagen - nochmal tippen';
    } finally {
      void progress.remove();
    }
  }

  function updateCheck() {
    if (!isNative || Date.now() - lastUpdateCheck < 3600_000) return;
    lastUpdateCheck = Date.now();
    checkForUpdates()
      .then((u) => (apkUrl = u.apkUrl))
      .catch((e) => console.warn('update check failed', e));
  }

  pb.authStore.onChange(() => {
    authed = pb.authStore.isValid;
    if (isNative) void Sleep.setAuth({ baseUrl: pb.baseURL, token: pb.authStore.isValid ? pb.authStore.token : '' });
  });

  // An installed PWA can sit in the background for days, so the token is
  // extended on every return to the foreground, not just on cold start.
  function refreshAuth() {
    if (pb.authStore.isValid) pb.collection('users').authRefresh().catch(() => {});
  }

  $effect(() => {
    if (!authed) return;
    refreshAuth();
    if (isNative) {
      updateCheck();
      void Sleep.setAuth({ baseUrl: pb.baseURL, token: pb.authStore.token });
      void Sleep.requestNotificationPermission();
      void store
        .init()
        .then(applyNativeActions)
        .then(() => (nativeReady = true));
      const listener = Sleep.addListener('pendingActions', () => void applyNativeActions());
      return () => {
        store.teardown();
        void listener.then((l) => l.remove());
      };
    }
    void ensurePushSubscription();
    void store.init().then(handleStopParam);
    return () => store.teardown();
  });

  // Native: hand the state to the ongoing notification and the widget.
  $effect(() => {
    if (!isNative || !nativeReady) return;
    const running = authed ? store.running : null;
    const lastWake = authed ? store.lastWake : null;
    void Sleep.setState({
      running: running
        ? { id: running.id, start: Date.parse(running.start), kind: running.kind, pauses: $state.snapshot(running.pauses ?? []) }
        : null,
      lastWake: lastWake ? Date.parse(lastWake) : null,
    });
  });

  /** Starts/stops made from the widget or notification; upserts, so re-applying is harmless. */
  async function applyNativeActions() {
    const { actions } = await Sleep.takePendingActions();
    for (const a of actions) store.put({ ...a, pauses: a.pauses ?? [], note: store.sessions[a.id]?.note ?? '' });
  }

  $effect(() => {
    if (isNative) return;
    const running = authed ? store.running : null;
    void syncNotification(running);
    if (!running) return;
    // Keep the duration in the title current while the app is alive.
    const timer = setInterval(() => void syncNotification(store.running), 60_000);
    return () => clearInterval(timer);
  });

  // "Aufgewacht" tapped in the notification while the app was closed.
  function handleStopParam() {
    const url = new URL(location.href);
    const at = Number(url.searchParams.get('stop'));
    if (!at) return;
    store.stop(new Date(at));
    url.searchParams.delete('stop');
    history.replaceState(null, '', url);
  }

  // ...and while the app was open.
  navigator.serviceWorker?.addEventListener('message', (e) => {
    if (e.data?.type === 'stop') store.stop(new Date(e.data.at));
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    refreshAuth();
    if (isNative) {
      void applyNativeActions();
      updateCheck();
    } else void syncNotification(store.running);
  });

  function logout() {
    if (!confirm('Abmelden?')) return;
    store.clear();
    pb.authStore.clear();
  }
</script>

{#if !authed}
  <Login />
{:else}
  <main>
    <header>
      <span class="title">Schlaf-Tracker</span>
      {#if !store.online || store.pendingCount}
        <span class="sync" title="Wird synchronisiert, sobald wieder online">
          {#if store.online}<Icon name="sync" size={14} />{:else}offline{/if}{store.pendingCount ? ` · ${store.pendingCount}` : ''}
        </span>
      {/if}
      <button class="ghost" onclick={logout} aria-label="Abmelden"><Icon name="logout" /></button>
    </header>

    {#if apkUrl}
      <button class="update" onclick={installUpdate}>
        {apkStatus || 'Neue App-Version verfügbar - zum Installieren tippen'}
      </button>
    {/if}

    {#if tab === 'now'}
      <Home />
    {:else if tab === 'history'}
      <History />
    {:else}
      <Stats />
    {/if}
  </main>

  <nav>
    <button class:active={tab === 'now'} onclick={() => (tab = 'now')}><Icon name="now" />Jetzt</button>
    <button class:active={tab === 'history'} onclick={() => (tab = 'history')}><Icon name="history" />Verlauf</button>
    <button class:active={tab === 'stats'} onclick={() => (tab = 'stats')}><Icon name="stats" />Statistik</button>
  </nav>
{/if}

<style>
  main {
    max-width: 560px;
    margin: 0 auto;
    padding: 0.75rem 1rem calc(5rem + env(safe-area-inset-bottom));
  }

  header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding-top: env(safe-area-inset-top);
  }

  .update {
    display: block;
    width: 100%;
    margin-top: 0.5rem;
    font-size: 0.85rem;
    text-align: left;
    border: 1px solid var(--nap);
  }

  .title {
    font-weight: 600;
    flex: 1;
  }

  .sync {
    font-size: 0.8rem;
    color: var(--nap);
  }

  nav {
    position: fixed;
    inset: auto 0 0 0;
    display: flex;
    gap: 0.5rem;
    padding: 0.5rem 1rem calc(0.5rem + env(safe-area-inset-bottom));
    background: var(--surface);
  }

  nav button {
    flex: 1;
    display: grid;
    justify-items: center;
    gap: 0.15rem;
    padding: 0.45rem 0;
    font-size: 0.8rem;
    background: transparent;
    color: var(--muted);
    font-weight: 600;
  }

  nav button.active {
    background: var(--surface-2);
    color: var(--text);
  }
</style>
