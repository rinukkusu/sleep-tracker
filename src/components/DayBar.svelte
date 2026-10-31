<script lang="ts">
  import { addDays } from '../lib/time';
  import type { Segment } from '../lib/stats';
  import type { Sleep } from '../lib/types';

  let {
    day,
    segments,
    now,
    onselect,
  }: { day: Date; segments: Segment[]; now: number; onselect?: (s: Sleep) => void } = $props();

  const nowPos = $derived.by(() => {
    const start = +day;
    const end = +addDays(day, 1);
    return now >= start && now < end ? (now - start) / (end - start) : null;
  });

  const pct = (v: number) => `${(v * 100).toFixed(3)}%`;
</script>

<div class="bar" role="img" aria-label="Schlaf über den Tag">
  {#each segments as seg (seg.sleep.id + seg.from)}
    <button
      class="seg {seg.sleep.kind}"
      class:running={!seg.sleep.end}
      style:left={pct(seg.from)}
      style:width={pct(seg.to - seg.from)}
      onclick={() => onselect?.(seg.sleep)}
      aria-label="Eintrag bearbeiten"
    ></button>
    {#each seg.gaps as gap}
      <div class="gap" style:left={pct(gap.from)} style:width={pct(gap.to - gap.from)}></div>
    {/each}
  {/each}
  {#if nowPos !== null}
    <div class="now" style:left={pct(nowPos)}></div>
  {/if}
</div>
<div class="ticks">
  {#each [0, 6, 12, 18, 24] as h}
    <span style:left={pct(h / 24)}>{h}</span>
  {/each}
</div>

<style>
  .bar {
    position: relative;
    height: 28px;
    border-radius: 8px;
    background: var(--awake);
    overflow: hidden;
  }

  .seg {
    position: absolute;
    top: 0;
    bottom: 0;
    padding: 0;
    border-radius: 0;
    min-width: 2px;
  }

  .seg.night {
    background: var(--night);
  }

  .seg.nap {
    background: var(--nap);
  }

  /* Briefly awake within a sleep */
  .gap {
    position: absolute;
    top: 25%;
    bottom: 25%;
    min-width: 1px;
    background: var(--awake);
    pointer-events: none;
  }

  .seg.running {
    animation: pulse 2s ease-in-out infinite;
  }

  .now {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    margin-left: -1px;
    background: var(--text);
    opacity: 0.7;
  }

  .ticks {
    position: relative;
    height: 1rem;
    font-size: 0.7rem;
    color: var(--muted);
  }

  .ticks span {
    position: absolute;
    transform: translateX(-50%);
  }

  .ticks span:first-child {
    transform: none;
  }

  .ticks span:last-child {
    transform: translateX(-100%);
  }

  @keyframes pulse {
    50% {
      opacity: 0.6;
    }
  }
</style>
