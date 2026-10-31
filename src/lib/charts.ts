// Plain SVG/canvas charts for the statistics tab. Each draw function clears
// its target and renders again (on data, range or size changes).
import { median, wakeWindows, type Span } from './predict';

const H = 3600_000;
const MIN = 60_000;
const DAY = 24 * H;
const NS = 'http://www.w3.org/2000/svg';

/** Ordinal ramp for the 1st..4th+ wake window, light to dark. */
export const WINDOW_COLORS = ['#a8b0ff', '#6f7dff', '#4152d9', '#2a3596'];

export interface Day {
  k: number;
  naps: number;
  nap: number;
  night: number;
  bed: number | null;
  wake: number | null;
}

export type Tip = { show: (html: string, ev: PointerEvent) => void; hide: () => void };

const css = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const colors = () => ({
  night: css('--night'),
  nap: css('--nap'),
  awake: css('--awake'),
  muted: css('--muted'),
  surface: css('--surface'),
  text: css('--text'),
});

export const dayKey = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return +d;
};
export const minsOfDay = (t: number) => {
  const d = new Date(t);
  return d.getHours() * 60 + d.getMinutes();
};
export const fmtH = (ms: number) => {
  const m = Math.round(ms / MIN);
  const h = Math.floor(m / 60);
  return h ? `${h}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`;
};
export const fmtClock = (mins: number) => {
  const m = (((Math.round(mins) % 1440) + 1440) % 1440) | 0;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
export const fmtDate = (t: number, opt: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: '2-digit' }) =>
  new Date(t).toLocaleDateString('de-DE', opt);
export const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
const monthShort = (d: Date) => d.toLocaleDateString('de-DE', { month: 'short' }).replace('.', '');

/** "Sleep day": naps of day D plus the night that starts on the evening of D. */
export function sleepDays(spans: Span[]): Day[] {
  const days = new Map<number, Day>();
  for (const x of spans) {
    const k = x.night && new Date(x.s).getHours() < 12 ? dayKey(x.s - DAY) : dayKey(x.s);
    let d = days.get(k);
    if (!d) days.set(k, (d = { k, naps: 0, nap: 0, night: 0, bed: null, wake: null }));
    if (x.night) {
      d.night += x.slept;
      d.bed = x.s;
      d.wake = x.e;
    } else {
      d.naps++;
      d.nap += x.slept;
    }
  }
  return [...days.values()].sort((a, b) => a.k - b.k);
}

// ---------- svg helpers ----------
function el(parent: Element, tag: string, attrs: Record<string, string | number>, text?: string) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  if (text != null) e.textContent = text;
  parent.appendChild(e);
  return e;
}

interface Frame {
  svg: SVGSVGElement;
  W: number;
  h: number;
  m: { l: number; r: number; t: number; b: number };
}

function frame(svg: SVGSVGElement, h: number): Frame {
  svg.innerHTML = '';
  const W = svg.clientWidth || (svg.parentElement?.clientWidth ?? 300);
  svg.setAttribute('viewBox', `0 0 ${W} ${h}`);
  svg.style.height = h + 'px';
  return { svg, W, h, m: { l: 34, r: 6, t: 8, b: 22 } };
}

function monthAxis(f: Frame, x: (t: number) => number, t0: number, t1: number) {
  const months = Math.round((t1 - t0) / (30 * DAY));
  const every = months > 8 ? 2 : 1;
  for (const d = new Date(t0); +d <= t1; d.setMonth(d.getMonth() + 1)) {
    d.setDate(1);
    if (+d < t0 || +d > t1 - 10 * DAY || d.getMonth() % every) continue;
    el(f.svg, 'text', { x: x(+d), y: f.h - 6, 'text-anchor': 'middle' }, monthShort(d));
  }
}

function yGrid(f: Frame, y: (v: number) => number, ticks: number[], fmt: (v: number) => string) {
  const c = colors();
  for (const v of ticks) {
    el(f.svg, 'line', { x1: f.m.l, x2: f.W - f.m.r, y1: y(v), y2: y(v), stroke: c.awake, 'stroke-width': 1 });
    el(f.svg, 'text', { x: f.m.l - 6, y: y(v) + 4, 'text-anchor': 'end' }, fmt(v));
  }
}

function rolling<T>(list: T[], n: number, fn: (x: T) => number | null, agg: (v: number[]) => number) {
  return list.map((_, i) => {
    const w = list
      .slice(Math.max(0, i - n + 1), i + 1)
      .map(fn)
      .filter((v): v is number => v != null && !isNaN(v));
    return w.length >= Math.min(n, 5) ? agg(w) : null;
  });
}

function path(points: ([number, number] | null)[]) {
  let d = '';
  let pen = false;
  for (const p of points) {
    if (!p) {
      pen = false;
      continue;
    }
    d += (pen ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1);
    pen = true;
  }
  return d;
}

/** Hit area: hover on desktop, tap/drag on the phone. */
function hit(target: Element, onMove: (ev: PointerEvent) => void, tip: Tip) {
  const t = target as SVGElement;
  t.onpointermove = onMove;
  t.onpointerdown = onMove;
  t.onpointerleave = () => tip.hide();
}

/** Crosshair + tooltip for the time series charts. */
function crosshair(f: Frame, list: Day[], x: (t: number) => number, html: (d: Day, i: number) => string, ys: (i: number) => number[], dotColors: string[], tip: Tip) {
  const c = colors();
  const line = el(f.svg, 'line', { y1: f.m.t, y2: f.h - f.m.b, stroke: c.muted, 'stroke-width': 1, opacity: 0 });
  const dots = dotColors.map((col) => el(f.svg, 'circle', { r: 4, fill: col, stroke: c.surface, 'stroke-width': 2, opacity: 0 }));
  const area = el(f.svg, 'rect', { x: f.m.l, y: 0, width: f.W - f.m.l - f.m.r, height: f.h, fill: 'transparent' });
  hit(
    area,
    (ev) => {
      const px = (ev.offsetX / f.svg.clientWidth) * f.W;
      let i = 0;
      let best = Infinity;
      list.forEach((d, j) => {
        const dist = Math.abs(x(d.k) - px);
        if (dist < best) {
          best = dist;
          i = j;
        }
      });
      const cx = x(list[i].k);
      line.setAttribute('x1', String(cx));
      line.setAttribute('x2', String(cx));
      line.setAttribute('opacity', '0.5');
      ys(i).forEach((cy, j) => {
        dots[j].setAttribute('cx', String(cx));
        dots[j].setAttribute('cy', String(cy));
        dots[j].setAttribute('opacity', '1');
      });
      tip.show(html(list[i], i), ev);
    },
    {
      show: tip.show,
      hide: () => {
        tip.hide();
        line.setAttribute('opacity', '0');
        dots.forEach((d) => d.setAttribute('opacity', '0'));
      },
    },
  );
}

// ---------- actogram: one row per day ----------
export function drawPattern(cv: HTMLCanvasElement, spans: Span[], tip: Tip) {
  const c = colors();
  const W = cv.clientWidth;
  const labelW = 36;
  const first = dayKey(spans[0].s);
  const last = dayKey(spans[spans.length - 1].e);
  const rows = Math.round((last - first) / DAY) + 1;
  // Fit roughly a year into ~2px rows, fewer days get thicker rows.
  const rowH = Math.max(2, Math.min(8, Math.floor(600 / rows)));
  const height = rows * rowH + 18;
  const dpr = devicePixelRatio || 1;
  cv.style.height = height + 'px';
  cv.width = W * dpr;
  cv.height = height * dpr;
  const g = cv.getContext('2d')!;
  g.scale(dpr, dpr);
  const plotW = W - labelW;
  const rowOf = (t: number) => Math.round((dayKey(t) - first) / DAY);
  g.fillStyle = c.awake;
  g.fillRect(labelW, 0, plotW, rows * rowH);
  const span = (a: number, b: number, color: string) => {
    for (let t = a; t < b; ) {
      const d0 = dayKey(t);
      const d1 = dayKey(d0 + 26 * H); // 23h/25h on DST days
      const next = Math.min(b, d1);
      g.fillStyle = color;
      g.fillRect(labelW + ((t - d0) / (d1 - d0)) * plotW, rowOf(t) * rowH, Math.max(1, ((next - t) / (d1 - d0)) * plotW), rowH);
      t = next;
    }
  };
  for (const x of spans) {
    span(x.s, x.e, x.night ? c.night : c.nap);
    for (const p of x.pauses) span(p[0], p[1], c.awake);
  }
  g.font = '11px system-ui, sans-serif';
  g.textBaseline = 'middle';
  for (let r = 0; r < rows; r++) {
    const d = new Date(first + r * DAY + 12 * H);
    if (d.getDate() !== 1) continue;
    g.fillStyle = 'rgba(255,255,255,.12)';
    g.fillRect(labelW, r * rowH, plotW, 1);
    g.fillStyle = c.muted;
    g.fillText(monthShort(d), 0, r * rowH + 4);
  }
  g.fillStyle = c.muted;
  g.textBaseline = 'top';
  g.textAlign = 'center';
  for (const h of [0, 6, 12, 18, 24]) g.fillText(String(h), labelW + (h / 24) * plotW, rows * rowH + 4);

  const move = (ev: PointerEvent) => {
    const r = Math.floor(ev.offsetY / rowH);
    if (r < 0 || r >= rows || ev.offsetX < labelW) return tip.hide();
    const k = dayKey(first + r * DAY + 12 * H);
    const list = spans.filter((x) => x.e > k && x.s < k + DAY);
    tip.show(
      `<b>${fmtDate(k, { weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit' })}</b><br>` +
        (list.map((x) => `${x.night ? '🌙' : '☀️'} ${fmtClock(minsOfDay(x.s))}–${fmtClock(minsOfDay(x.e))}`).join('<br>') || 'keine Einträge'),
      ev,
    );
  };
  cv.onpointermove = move;
  cv.onpointerdown = move;
  cv.onpointerleave = () => tip.hide();
}

// ---------- sleep per day, weekly average ----------
export function drawWeekly(svg: SVGSVGElement, days: Day[], tip: Tip) {
  const c = colors();
  const f = frame(svg, 220);
  const weeks = new Map<number, Day[]>();
  for (const d of days) {
    const wk = d.k - ((new Date(d.k).getDay() + 6) % 7) * DAY;
    if (!weeks.has(wk)) weeks.set(wk, []);
    weeks.get(wk)!.push(d);
  }
  const list = [...weeks.entries()]
    .filter(([, v]) => v.length >= 4)
    .map(([k, v]) => ({ k, night: mean(v.map((d) => d.night)) / H, nap: mean(v.map((d) => d.nap)) / H }));
  if (!list.length) return;
  const max = 16;
  const pw = f.W - f.m.l - f.m.r;
  const bw = pw / list.length;
  const y = (v: number) => f.h - f.m.b - (v / max) * (f.h - f.m.t - f.m.b);
  yGrid(f, y, [0, 4, 8, 12, 16], (v) => v + 'h');
  const t0 = list[0].k;
  const t1 = list[list.length - 1].k + 7 * DAY;
  monthAxis(f, (t) => f.m.l + ((t - t0) / (t1 - t0)) * pw, t0, t1);
  list.forEach((w, i) => {
    const x = f.m.l + i * bw + 1;
    const wdt = Math.max(1, bw - 2);
    el(f.svg, 'rect', { x, y: y(w.night), width: wdt, height: y(0) - y(w.night), fill: c.night });
    el(f.svg, 'rect', {
      x,
      y: y(w.night + w.nap),
      width: wdt,
      height: Math.max(0, y(w.night) - y(w.night + w.nap) - 2),
      fill: c.nap,
      rx: Math.min(2, wdt / 2),
    });
    const area = el(f.svg, 'rect', { x: f.m.l + i * bw, y: f.m.t, width: bw, height: f.h - f.m.t - f.m.b, fill: 'transparent' });
    hit(
      area,
      (ev) =>
        tip.show(`<b>Woche ab ${fmtDate(w.k)}</b><br>🌙 ${fmtH(w.night * H)} · ☀️ ${fmtH(w.nap * H)}<br>gesamt ${fmtH((w.night + w.nap) * H)} / Tag`, ev),
      tip,
    );
  });
}

// ---------- naps per day ----------
export function drawNaps(svg: SVGSVGElement, days: Day[], tip: Tip) {
  const c = colors();
  const f = frame(svg, 200);
  if (days.length < 2) return;
  const t0 = days[0].k;
  const t1 = days[days.length - 1].k;
  const pw = f.W - f.m.l - f.m.r;
  const x = (t: number) => f.m.l + ((t - t0) / (t1 - t0)) * pw;
  const max = Math.max(4, Math.ceil(Math.max(...days.map((d) => d.naps)) / 2) * 2);
  const y = (v: number) => f.h - f.m.b - (v / max) * (f.h - f.m.t - f.m.b);
  yGrid(f, y, Array.from({ length: max / 2 + 1 }, (_, i) => i * 2), String);
  monthAxis(f, x, t0, t1);
  for (const d of days) el(f.svg, 'circle', { cx: x(d.k), cy: y(d.naps), r: 2, fill: c.nap, 'fill-opacity': 0.35 });
  const avg = rolling(days, 14, (d) => d.naps, mean);
  el(f.svg, 'path', { d: path(avg.map((v, i) => (v == null ? null : [x(days[i].k), y(v)]))), fill: 'none', stroke: c.nap, 'stroke-width': 2 });
  crosshair(
    f,
    days,
    x,
    (d, i) => `<b>${fmtDate(d.k)}</b><br>${d.naps} Nickerchen · ${fmtH(d.nap)}<br>Schnitt 14 Tage: ${avg[i]?.toFixed(1).replace('.', ',') ?? '–'}`,
    (i) => [y(avg[i] ?? days[i].naps)],
    [c.nap],
    tip,
  );
}

// ---------- bedtime & wake-up ----------
export function drawClock(svg: SVGSVGElement, days: Day[], tip: Tip) {
  const c = colors();
  const f = frame(svg, 240);
  const list = days.filter((d) => d.bed != null && d.wake != null);
  if (list.length < 2) return;
  const t0 = list[0].k;
  const t1 = list[list.length - 1].k;
  const pw = f.W - f.m.l - f.m.r;
  const x = (t: number) => f.m.l + ((t - t0) / (t1 - t0)) * pw;
  const lo = 5 * 60;
  const hi = 24 * 60;
  const y = (m: number) => f.m.t + ((Math.min(Math.max(m, lo), hi) - lo) / (hi - lo)) * (f.h - f.m.t - f.m.b);
  yGrid(f, y, [6, 9, 12, 15, 18, 21, 24].map((h) => h * 60), (m) => fmtClock(m).slice(0, 2) + 'h');
  monthAxis(f, x, t0, t1);
  const bedM = (d: Day) => {
    const m = minsOfDay(d.bed!);
    return m < 12 * 60 ? m + 1440 : m;
  };
  const wakeM = (d: Day) => minsOfDay(d.wake!);
  for (const d of list) {
    el(f.svg, 'circle', { cx: x(d.k), cy: y(bedM(d)), r: 2, fill: c.night, 'fill-opacity': 0.35 });
    el(f.svg, 'circle', { cx: x(d.k), cy: y(wakeM(d)), r: 2, fill: c.nap, 'fill-opacity': 0.35 });
  }
  const bed = rolling(list, 14, bedM, median);
  const wake = rolling(list, 14, wakeM, median);
  el(f.svg, 'path', { d: path(bed.map((v, i) => (v == null ? null : [x(list[i].k), y(v)]))), fill: 'none', stroke: c.night, 'stroke-width': 2 });
  el(f.svg, 'path', { d: path(wake.map((v, i) => (v == null ? null : [x(list[i].k), y(v)]))), fill: 'none', stroke: c.nap, 'stroke-width': 2 });
  const med = (v: number | null) => (v == null ? '' : ` <span style="color:${c.muted}">(Median ${fmtClock(v)})</span>`);
  crosshair(
    f,
    list,
    x,
    (d, i) => `<b>${fmtDate(d.k)}</b><br>🌙 ins Bett ${fmtClock(bedM(d))}${med(bed[i])}<br>☀️ wach ${fmtClock(wakeM(d))}${med(wake[i])}`,
    (i) => [y(bed[i] ?? bedM(list[i])), y(wake[i] ?? wakeM(list[i]))],
    [c.night, c.nap],
    tip,
  );
}

// ---------- wake windows per month, by position in the day ----------
export function drawWindows(svg: SVGSVGElement, spans: Span[], tip: Tip) {
  const f = frame(svg, 220);
  const byMonth = new Map<number, number[][]>();
  for (const w of wakeWindows(spans)) {
    const d = new Date(w.t);
    const k = d.getFullYear() * 12 + d.getMonth();
    if (!byMonth.has(k)) byMonth.set(k, [[], [], [], []]);
    byMonth.get(k)![Math.min(w.pos, 3)].push(w.ms / H);
  }
  const list = [...byMonth.entries()].sort((a, b) => a[0] - b[0]);
  if (!list.length) return;
  const max = 6;
  const pw = f.W - f.m.l - f.m.r;
  const gw = pw / list.length;
  const y = (v: number) => f.h - f.m.b - (Math.min(v, max) / max) * (f.h - f.m.t - f.m.b);
  yGrid(f, y, [0, 2, 4, 6], (v) => v + 'h');
  list.forEach(([k, groups], i) => {
    const shown = groups.map((g, p) => ({ p, v: median(g), n: g.length })).filter((g) => g.n >= 8);
    const bw = Math.max(2, (gw - 6) / 4);
    shown.forEach((g, j) => {
      el(f.svg, 'rect', {
        x: f.m.l + i * gw + 3 + j * bw,
        y: y(g.v),
        width: Math.max(1, bw - 1),
        height: y(0) - y(g.v),
        fill: WINDOW_COLORS[g.p],
        rx: Math.min(2, bw / 3),
      });
    });
    const d = new Date(Math.floor(k / 12), k % 12, 1);
    if (list.length <= 6 || i % 2 === 0) el(f.svg, 'text', { x: f.m.l + i * gw + gw / 2, y: f.h - 6, 'text-anchor': 'middle' }, monthShort(d));
    const area = el(f.svg, 'rect', { x: f.m.l + i * gw, y: 0, width: gw, height: f.h, fill: 'transparent' });
    hit(
      area,
      (ev) =>
        tip.show(
          `<b>${d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}</b><br>` +
            (shown
              .map(
                (g) =>
                  `<i style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${WINDOW_COLORS[g.p]}"></i> ${g.p + 1}.${g.p === 3 ? '+' : ''} Wachphase: ${fmtH(g.v * H)}`,
              )
              .join('<br>') || 'zu wenig Daten'),
          ev,
        ),
      tip,
    );
  });
}
