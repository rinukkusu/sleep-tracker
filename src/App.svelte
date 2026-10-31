<script lang="ts">
  import { pb } from './lib/pb';
  import { store } from './lib/store.svelte';
  import { syncNotification } from './lib/notify';
  import Login from './components/Login.svelte';
  import Home from './components/Home.svelte';
  import History from './components/History.svelte';
  import Icon from './components/Icon.svelte';

  let authed = $state(pb.authStore.isValid);
  let tab = $state<'now' | 'history'>('now');

  pb.authStore.onChange(() => (authed = pb.authStore.isValid));

  // An installed PWA can sit in the background for days, so the token is
  // extended on every return to the foreground, not just on cold start.
  function refreshAuth() {
    if (pb.authStore.isValid) pb.collection('users').authRefresh().catch(() => {});
  }

  $effect(() => {
    if (!authed) return;
    refreshAuth();
    void store.init().then(handleStopParam);
    return () => store.teardown();
  });

  $effect(() => {
    void syncNotification(authed ? store.running : null);
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
    void syncNotification(store.running, true);
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

    {#if tab === 'now'}
      <Home />
    {:else}
      <History />
    {/if}
  </main>

  <nav>
    <button class:active={tab === 'now'} onclick={() => (tab = 'now')}>Jetzt</button>
    <button class:active={tab === 'history'} onclick={() => (tab = 'history')}>Verlauf</button>
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
    background: transparent;
    color: var(--muted);
    font-weight: 600;
  }

  nav button.active {
    background: var(--surface-2);
    color: var(--text);
  }
</style>
