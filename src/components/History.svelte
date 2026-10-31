<script lang="ts">
  import { clock } from '../lib/clock.svelte';
  import { dayStats, pausedMs, sleptMs } from '../lib/stats';
  import { store } from '../lib/store.svelte';
  import { addDays, fmtDay, fmtDuration, fmtTime, kindIcon, startOfDay } from '../lib/time';
  import type { Sleep } from '../lib/types';
  import DayBar from './DayBar.svelte';
  import EditDialog from './EditDialog.svelte';

  let editing = $state<Sleep | null>(null);
  let creating = $state(false);
  let expanded = $state<number | null>(null);
  let loading = $state(false);

  const days = $derived.by(() => {
    const out: Date[] = [];
    for (let d = startOfDay(clock.now); d >= store.from; d = addDays(d, -1)) out.push(d);
    return out;
  });

  // Recomputing per minute is plenty for the history view.
  const minute = $derived(Math.floor(clock.now / 60_000) * 60_000);
  const rows = $derived(days.map((day) => ({ day, stats: dayStats(store.sorted, day, minute) })));

  async function more() {
    loading = true;
    await store.loadMore();
    loading = false;
  }
</script>

<div class="top">
  <h2>Verlauf</h2>
  <button onclick={() => (creating = true)}>+ Nachtragen</button>
</div>

<div class="legend muted">
  <span><i class="night"></i>Nacht</span>
  <span><i class="nap"></i>Nickerchen</span>
  <span><i class="awake"></i>wach</span>
</div>

{#each rows as { day, stats } (+day)}
  <section class="card day">
    <button class="head" onclick={() => (expanded = expanded === +day ? null : +day)}>
      <strong>{fmtDay(day)}</strong>
      <span class="total tabular">{fmtDuration(stats.total)}</span>
      {#if stats.total}
        <span class="detail muted tabular">
          🌙 {fmtDuration(stats.byKind.night)} · ☀️ {stats.naps}× {fmtDuration(stats.byKind.nap)}
        </span>
      {/if}
    </button>
    <DayBar {day} segments={stats.segments} now={clock.now} onselect={(s) => (editing = s)} />

    {#if expanded === +day}
      <ul>
        {#each stats.segments as { sleep } (sleep.id)}
          <li>
            <button onclick={() => (editing = sleep)}>
              <span>{kindIcon[sleep.kind]}</span>
              <span class="tabular">{fmtTime(sleep.start)} – {sleep.end ? fmtTime(sleep.end) : 'jetzt'}</span>
              <span class="muted tabular">
                {fmtDuration(sleptMs(sleep, clock.now))}{#if sleep.pauses?.length} · {fmtDuration(pausedMs(sleep, clock.now))} wach{/if}
              </span>
              {#if sleep.note}<span class="note muted">{sleep.note}</span>{/if}
            </button>
          </li>
        {:else}
          <li class="muted">Keine Einträge</li>
        {/each}
      </ul>
    {/if}
  </section>
{/each}

<button class="ghost more" onclick={more} disabled={loading}>
  {loading ? 'Lädt…' : 'Ältere Tage laden'}
</button>

{#if editing || creating}
  <EditDialog
    sleep={editing}
    onclose={() => {
      editing = null;
      creating = false;
    }}
  />
{/if}

<style>
  .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 1rem 0 0.5rem;
  }

  h2 {
    margin: 0;
    font-size: 1.2rem;
  }

  .legend {
    display: flex;
    gap: 1rem;
    font-size: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .legend i {
    display: inline-block;
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 3px;
    margin-right: 0.3rem;
    vertical-align: -1px;
  }

  .legend .night {
    background: var(--night);
  }

  .legend .nap {
    background: var(--nap);
  }

  .legend .awake {
    background: var(--awake);
  }

  .day {
    display: grid;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .head {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: baseline;
    gap: 0.15rem 0.5rem;
    background: transparent;
    padding: 0;
    font-size: 0.9rem;
    text-align: left;
  }

  .total {
    font-weight: 600;
  }

  .detail {
    grid-column: 1 / -1;
    font-size: 0.8rem;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.25rem;
  }

  li button {
    width: 100%;
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    align-items: baseline;
    text-align: left;
    padding: 0.5rem 0.6rem;
    background: var(--surface-2);
  }

  .note {
    flex-basis: 100%;
    font-size: 0.85rem;
  }

  .more {
    display: block;
    margin: 0 auto;
  }
</style>
