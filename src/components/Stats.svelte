<script lang="ts">
  import {
    WINDOW_COLORS,
    drawClock,
    drawNaps,
    drawPattern,
    drawWeekly,
    drawWindows,
    fmtClock,
    fmtDate,
    fmtH,
    mean,
    minsOfDay,
    sleepDays,
    type Tip,
  } from '../lib/charts';
  import { isNative, Sleep } from '../lib/native';
  import { median, predictNext, toSpans } from '../lib/predict';
  import { untrack } from 'svelte';
  import { store } from '../lib/store.svelte';
  import { fmtTime } from '../lib/time';
  import type { Sleep } from '../lib/types';

  const DAY = 24 * 3600_000;
  const ranges = { '3m': ['3 Monate', 91], '1y': ['1 Jahr', 365], all: ['Alles', Infinity] } as const;
  type Range = keyof typeof ranges;

  let history = $state<Sleep[]>(store.sorted);
  let loading = $state(true);
  let range = $state<Range>('1y');
  let width = $state(0);
  let version = $state('');
  const webVersion = (import.meta.env.VITE_WEB_VERSION ?? 'dev').slice(0, 7);
  if (isNative) void Sleep.info().then((i) => (version = i.version));

  let pattern: HTMLCanvasElement;
  let weekly: SVGSVGElement;
  let naps: SVGSVGElement;
  let clockChart: SVGSVGElement;
  let windows: SVGSVGElement;
  let tipEl: HTMLDivElement;

  $effect(() => {
    void store.fetchAll().then((all) => {
      history = all;
      loading = false;
    });
  });

  // Re-merge local changes (e.g. a sleep just stopped) without fetching again.
  $effect(() => {
    const local = store.sorted;
    if (loading) return;
    const byId = new Map(untrack(() => $state.snapshot(history)).map((s) => [s.id, s] as const));
    for (const s of local) byId.set(s.id, $state.snapshot(s));
    history = [...byId.values()];
  });

  const spans = $derived(toSpans(history));
  const days = $derived(sleepDays(spans).slice(0, -1)); // the current day is still incomplete
  const next = $derived(store.running ? null : predictNext(spans));
  const last14 = $derived(days.slice(-14));

  const inRange = $derived.by(() => {
    const from = Date.now() - ranges[range][1] * DAY;
    return { spans: spans.filter((x) => x.s >= from), days: days.filter((d) => d.k >= from) };
  });

  const tiles = $derived.by(() => {
    if (!last14.length) return [];
    const total = spans.reduce((a, x) => a + x.slept, 0);
    const beds = last14.filter((d) => d.bed != null).map((d) => minsOfDay(d.bed!));
    return [
      [fmtH(median(last14.map((d) => d.nap + d.night))), 'Schlaf pro Tag (14 Tage)'],
      [mean(last14.map((d) => d.naps)).toFixed(1).replace('.', ','), 'Nickerchen pro Tag'],
      [Math.round(total / 3600_000).toLocaleString('de-DE') + ' h', `geschlafen insgesamt (≈ ${Math.round(total / DAY)} Tage)`],
      [beds.length ? fmtClock(median(beds)) : '–', 'typisch ins Bett'],
    ];
  });

  // The first month is usually patchy (newborn, tracking just started), so it doesn't count for records.
  const records = $derived.by(() => {
    if (!spans.length) return [];
    const from = spans[0].s + 30 * DAY;
    const nights = spans.filter((x) => x.night && x.s >= from);
    const napList = spans.filter((x) => !x.night && x.s >= from);
    const recDays = days.filter((d) => d.k >= from);
    if (!nights.length || !napList.length || !recDays.length) return [];
    const max = <T,>(l: T[], f: (x: T) => number) => l.reduce((a, b) => (f(b) > f(a) ? b : a));
    const longestNight = max(nights, (x) => x.slept);
    const longestNap = max(napList, (x) => x.slept);
    const most = max(recDays, (d) => d.nap + d.night);
    const mostNaps = max(recDays, (d) => d.naps);
    const evening = nights.filter((x) => minsOfDay(x.s) > 16 * 60);
    const earliest = evening.length ? max(evening, (x) => -minsOfDay(x.s)) : null;
    const firstOneNap = days.find((d, i) => d.naps === 1 && days.slice(i, i + 3).every((x) => x.naps === 1));
    return [
      ['Längste Nacht', `${fmtH(longestNight.slept)} · ${fmtDate(longestNight.s)}`],
      ['Längstes Nickerchen', `${fmtH(longestNap.slept)} · ${fmtDate(longestNap.s)}`],
      ['Am meisten an einem Tag', `${fmtH(most.nap + most.night)} · ${fmtDate(most.k)}`],
      ['Meiste Nickerchen', `${mostNaps.naps}× · ${fmtDate(mostNaps.k)}`],
      ['Früheste Schlafenszeit', earliest ? `${fmtClock(minsOfDay(earliest.s))} · ${fmtDate(earliest.s)}` : '–'],
      ['Erstmals 3 Tage nur 1 Nickerchen', firstOneNap ? fmtDate(firstOneNap.k) : '–'],
    ];
  });

  const tip: Tip = {
    show(html, ev) {
      tipEl.innerHTML = html;
      tipEl.style.opacity = '1';
      const r = tipEl.getBoundingClientRect();
      let x = ev.clientX + 12;
      let y = ev.clientY - r.height - 12;
      if (x + r.width > innerWidth - 8) x = Math.max(8, ev.clientX - r.width - 12);
      if (y < 8) y = ev.clientY + 16;
      tipEl.style.left = x + 'px';
      tipEl.style.top = y + 'px';
    },
    hide() {
      tipEl.style.opacity = '0';
    },
  };

  $effect(() => {
    void width; // redraw on resize
    const { spans: s, days: d } = inRange;
    if (!s.length) return;
    drawPattern(pattern, s, tip);
    drawWeekly(weekly, d, tip);
    drawNaps(naps, d, tip);
    drawClock(clockChart, d, tip);
    drawWindows(windows, s, tip);
  });
</script>

<svelte:window onscroll={() => tip?.hide()} />

<div class="stats" bind:clientWidth={width}>
  {#if next}
    <section class="card next">
      <span class="moon">🌙</span>
      <div>
        <div class="muted small">Nächster Schlaf: {next.bedtime ? 'Schlafenszeit' : `${next.pos + 1}. Nickerchen`}</div>
        <div class="at tabular">ca. {fmtTime(next.at)}</div>
        {#if next.typical.length}
          <div class="muted small">
            {next.typical.map((ms, i) => `${i + 1}. Wachphase ${fmtH(ms)}`).join(' · ')}
          </div>
        {/if}
      </div>
    </section>
  {/if}

  <section class="tiles">
    {#each tiles as [v, l]}
      <div class="tile"><div class="v tabular">{v}</div><div class="muted small">{l}</div></div>
    {/each}
  </section>

  <div class="ranges" role="tablist">
    {#each Object.entries(ranges) as [key, [label]]}
      <button class:active={range === key} onclick={() => (range = key as Range)}>{label}</button>
    {/each}
  </div>

  {#if loading}<p class="muted small center">Lade Verlauf…</p>{/if}

  <section class="card">
    <h2>Schlafmuster</h2>
    <p class="muted small">Jeder Tag eine Zeile, oben die ältesten.</p>
    <div class="legend">
      <span><i style:background="var(--night)"></i>Nacht</span>
      <span><i style:background="var(--nap)"></i>Nickerchen</span>
      <span><i style:background="var(--awake)"></i>wach</span>
    </div>
    <canvas bind:this={pattern}></canvas>
  </section>

  <section class="card">
    <h2>Schlaf pro Tag</h2>
    <p class="muted small">Wochendurchschnitt, Nacht und Tagschlaf gestapelt.</p>
    <div class="legend">
      <span><i style:background="var(--night)"></i>Nacht</span>
      <span><i style:background="var(--nap)"></i>Tagschlaf</span>
    </div>
    <svg bind:this={weekly}></svg>
  </section>

  <section class="card">
    <h2>Nickerchen pro Tag</h2>
    <p class="muted small">Punkte = einzelne Tage, Linie = Schnitt der letzten 14 Tage.</p>
    <svg bind:this={naps}></svg>
  </section>

  <section class="card">
    <h2>Ins Bett &amp; Aufwachen</h2>
    <p class="muted small">Linie = Median der letzten 14 Tage.</p>
    <div class="legend">
      <span><i style:background="var(--night)"></i>Ins Bett</span>
      <span><i style:background="var(--nap)"></i>Aufgewacht</span>
    </div>
    <svg bind:this={clockChart}></svg>
  </section>

  <section class="card">
    <h2>Wachfenster</h2>
    <p class="muted small">Wie lange sie typisch wach ist, nach Wachphase des Tages (Median pro Monat).</p>
    <div class="legend">
      {#each ['1. Wachphase', '2.', '3.', '4. und mehr'] as label, i}
        <span><i style:background={WINDOW_COLORS[i]}></i>{label}</span>
      {/each}
    </div>
    <svg bind:this={windows}></svg>
  </section>

  {#if records.length}
    <section class="card">
      <h2>Rekorde</h2>
      <ul class="records">
        {#each records as [label, value]}
          <li><span>{label}</span><span class="muted">{value}</span></li>
        {/each}
      </ul>
    </section>
  {/if}
</div>

<p class="muted small center version">
  {version ? `Version ${version} · ` : ''}Web {webVersion}
</p>

<div class="tip" bind:this={tipEl}></div>

<style>
  .stats {
    display: grid;
    gap: 0.9rem;
    margin-top: 0.75rem;
  }

  .small {
    font-size: 0.8rem;
  }

  .center {
    text-align: center;
  }

  h2 {
    font-size: 1rem;
    margin: 0;
  }

  .card p {
    margin: 0.1rem 0 0.6rem;
  }

  .next {
    display: flex;
    align-items: center;
    gap: 0.9rem;
  }

  .moon {
    font-size: 1.8rem;
  }

  .at {
    font-size: 1.9rem;
    font-weight: 700;
    line-height: 1.2;
  }

  .tiles {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.6rem;
  }

  .tile {
    background: var(--surface);
    border-radius: 12px;
    padding: 0.6rem 0.75rem;
  }

  .tile .v {
    font-size: 1.35rem;
    font-weight: 600;
  }

  .ranges {
    display: flex;
    gap: 0.3rem;
    background: var(--surface);
    padding: 0.3rem;
    border-radius: 12px;
  }

  .ranges button {
    flex: 1;
    padding: 0.4rem 0;
    background: transparent;
    color: var(--muted);
    font-size: 0.85rem;
  }

  .ranges button.active {
    background: var(--surface-2);
    color: var(--text);
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 0.9rem;
    color: var(--muted);
    font-size: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .legend i {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 3px;
    margin-right: 5px;
    vertical-align: -1px;
  }

  canvas,
  svg {
    display: block;
    width: 100%;
    overflow: visible;
    touch-action: pan-y;
  }

  svg :global(text) {
    fill: var(--muted);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }

  .records {
    list-style: none;
    margin: 0.5rem 0 0;
    padding: 0;
  }

  .records li {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.45rem 0;
    border-bottom: 1px solid var(--surface-2);
    font-size: 0.9rem;
  }

  .records li:last-child {
    border-bottom: 0;
  }

  .records li span:last-child {
    text-align: right;
  }

  .version {
    margin: 1.5rem 0 0;
    opacity: 0.6;
  }

  .tip {
    position: fixed;
    z-index: 10;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.1s;
    background: #0b0d18;
    border: 1px solid var(--surface-2);
    border-radius: 8px;
    padding: 0.35rem 0.55rem;
    font-size: 0.8rem;
    white-space: nowrap;
  }
</style>
