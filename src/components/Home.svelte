<script lang="ts">
  import { clock } from '../lib/clock.svelte';
  import { isNative } from '../lib/native';
  import { requestNotifyPermission } from '../lib/notify';
  import { dayStats } from '../lib/stats';
  import { store } from '../lib/store.svelte';
  import { defaultKind, fmtDuration, fmtTime, fmtTimer, kindIcon, kindLabel, startOfDay } from '../lib/time';
  import type { Kind, Sleep } from '../lib/types';
  import DayBar from './DayBar.svelte';
  import EditDialog from './EditDialog.svelte';
  import Icon from './Icon.svelte';

  let kind = $state<Kind>(defaultKind());
  let editing = $state<Sleep | null>(null);
  // The Android app asks for the permission itself on start.
  let permission = $state(!isNative && 'Notification' in window ? Notification.permission : 'granted');

  async function enableNotifications() {
    await requestNotifyPermission();
    if (!isNative) permission = Notification.permission;
  }

  const running = $derived(store.running);
  const today = $derived(startOfDay(clock.now));
  const stats = $derived(dayStats(store.sorted, today, clock.now));

  function toggle() {
    navigator.vibrate?.(30);
    if (running) {
      store.stop();
      kind = defaultKind();
    } else {
      store.start(kind);
      void enableNotifications();
    }
  }

  function switchRunningKind() {
    if (!running) return;
    store.put({ ...running, kind: running.kind === 'nap' ? 'night' : 'nap' });
  }
</script>

{#if permission === 'default'}
  <button class="notify-banner" onclick={enableNotifications}>
    Benachrichtigungen aktivieren, um den Schlaf auch bei geschlossener App zu sehen
  </button>
{/if}

<section class="status">
  {#if running}
    <button class="kind-chip {running.kind}" onclick={switchRunningKind}>
      {kindIcon[running.kind]} {kindLabel[running.kind]}
    </button>
    <div class="timer tabular">{fmtTimer(clock.now - Date.parse(running.start))}</div>
    <button class="ghost since" onclick={() => (editing = running)}>
      schläft seit {fmtTime(running.start)} <Icon name="edit" size={14} />
    </button>
  {:else}
    <div class="kinds">
      {#each ['night', 'nap'] as const as k}
        <button class="{k}" class:active={kind === k} onclick={() => (kind = k)}>
          {kindIcon[k]} {kindLabel[k]}
        </button>
      {/each}
    </div>
    <div class="timer tabular muted">
      {store.lastWake ? fmtDuration(clock.now - Date.parse(store.lastWake)) : '–'}
    </div>
    <div class="since muted">{store.lastWake ? `wach seit ${fmtTime(store.lastWake)}` : 'noch keine Einträge'}</div>
  {/if}
</section>

<button class="big {running ? 'wake' : kind}" onclick={toggle}>
  {running ? 'Aufgewacht' : 'Schläft'}
</button>

<section class="card today">
  <div class="row">
    <strong>Heute</strong>
    <span class="muted tabular">
      {fmtDuration(stats.total)} Schlaf · {stats.naps} Nickerchen
    </span>
  </div>
  <DayBar day={today} segments={stats.segments} now={clock.now} onselect={(s) => (editing = s)} />
</section>

{#if editing}
  <EditDialog sleep={editing} onclose={() => (editing = null)} />
{/if}

<style>
  .notify-banner {
    display: block;
    width: 100%;
    margin-top: 0.75rem;
    font-size: 0.85rem;
    text-align: left;
    border: 1px solid var(--night);
  }

  .status {
    display: grid;
    justify-items: center;
    gap: 0.5rem;
    margin: 2rem 0 1.5rem;
  }

  .timer {
    font-size: clamp(3rem, 16vw, 5rem);
    font-weight: 200;
    line-height: 1;
  }

  .since {
    font-size: 0.95rem;
  }

  .kinds {
    display: flex;
    gap: 0.5rem;
  }

  .kinds button.active.night,
  .kind-chip.night {
    background: var(--night);
    color: #fff;
  }

  .kinds button.active.nap,
  .kind-chip.nap {
    background: var(--nap);
    color: #1a1a1a;
  }

  .kind-chip {
    border-radius: 999px;
    padding: 0.4rem 0.9rem;
    font-size: 0.9rem;
  }

  .big {
    display: block;
    width: min(70vw, 280px);
    aspect-ratio: 1;
    margin: 0 auto 2rem;
    border-radius: 50%;
    font-size: 1.7rem;
    font-weight: 600;
    color: #fff;
    box-shadow: 0 10px 40px rgb(0 0 0 / 0.35);
    transition: transform 0.1s;
  }

  .big:active {
    transform: scale(0.96);
  }

  .big.night {
    background: radial-gradient(circle at 30% 30%, #8d98ff, var(--night));
  }

  .big.nap {
    background: radial-gradient(circle at 30% 30%, #ffd27f, var(--nap));
    color: #1a1a1a;
  }

  .big.wake {
    background: radial-gradient(circle at 30% 30%, #3a4170, var(--surface-2));
  }

  .today {
    display: grid;
    gap: 0.6rem;
  }

  .row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.5rem;
    font-size: 0.9rem;
  }
</style>
