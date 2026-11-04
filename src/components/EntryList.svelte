<script lang="ts">
  import { clock } from '../lib/clock.svelte';
  import { pausedMs, sleptMs } from '../lib/stats';
  import { fmtDuration, fmtTime, kindIcon } from '../lib/time';
  import type { Sleep } from '../lib/types';

  let { sleeps, onselect }: { sleeps: Sleep[]; onselect: (s: Sleep) => void } = $props();
</script>

<ul>
  {#each sleeps as sleep (sleep.id)}
    <li>
      <button onclick={() => onselect(sleep)}>
        <span>{kindIcon[sleep.kind]}</span>
        <span class="tabular">{fmtTime(sleep.start)} – {sleep.end ? fmtTime(sleep.end) : 'jetzt'}</span>
        <span class="muted tabular">
          {fmtDuration(sleptMs(sleep, clock.now))}{#if sleep.pauses?.length}{' · '}{fmtDuration(pausedMs(sleep, clock.now))} wach{/if}
        </span>
        {#if sleep.by}<span class="by" title="zuletzt von {sleep.by}">{sleep.by[0].toUpperCase()}</span>{/if}
        {#if sleep.note}<span class="note muted">{sleep.note}</span>{/if}
      </button>
    </li>
  {:else}
    <li class="muted">Keine Einträge</li>
  {/each}
</ul>

<style>
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.25rem;
  }

  li button {
    width: 100%;
    display: grid;
    grid-template-columns: auto auto 1fr auto;
    gap: 0.25rem 0.6rem;
    align-items: baseline;
    text-align: left;
    padding: 0.5rem 0.6rem;
    background: var(--surface-2);
  }

  .by {
    grid-column: 4;
    align-self: center;
    width: 1.4rem;
    height: 1.4rem;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--surface);
    color: var(--muted);
    font-size: 0.7rem;
    font-weight: 600;
  }

  .note {
    grid-column: 1 / -1;
    font-size: 0.85rem;
  }
</style>
