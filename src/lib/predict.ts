import { sleptMs } from './stats';
import type { Sleep } from './types';

const H = 3600_000;
const DAY = 24 * H;

/** A finished sleep as plain numbers, oldest first. */
export interface Span {
  s: number;
  e: number;
  night: boolean;
  slept: number;
  pauses: [number, number][];
}

export function toSpans(sleeps: Sleep[]): Span[] {
  return sleeps
    .filter((x) => x.end)
    .map((x) => ({
      s: Date.parse(x.start),
      e: Date.parse(x.end!),
      night: x.kind === 'night',
      slept: sleptMs(x, 0),
      pauses: (x.pauses ?? []).filter((p) => p.end).map((p) => [Date.parse(p.start), Date.parse(p.end!)] as [number, number]),
    }))
    .sort((a, b) => a.s - b.s);
}

export interface WakeWindow {
  /** When the window ended (= next sleep started) */
  t: number;
  /** Naps she already had since the night ended (0 = after waking up in the morning) */
  pos: number;
  ms: number;
  toNight: boolean;
}

export function wakeWindows(spans: Span[]): WakeWindow[] {
  const out: WakeWindow[] = [];
  for (let i = 1, pos = 0; i < spans.length; i++) {
    const a = spans[i - 1];
    const b = spans[i];
    pos = a.night ? 0 : pos + 1;
    const ms = b.s - a.e;
    if (ms > 0 && ms < 10 * H) out.push({ t: b.s, pos, ms, toNight: b.night });
  }
  return out;
}

export function median(values: number[]): number {
  const v = [...values].sort((a, b) => a - b);
  if (!v.length) return NaN;
  const i = v.length >> 1;
  return v.length % 2 ? v[i] : (v[i - 1] + v[i]) / 2;
}

export interface Prediction {
  at: number;
  bedtime: boolean;
  /** 0-based position of the current wake window */
  pos: number;
  windowMs: number;
  /** Typical length of the 1st, 2nd, ... wake window lately */
  typical: number[];
}

/**
 * Next sleep from the typical length of the same wake window of the day
 * (the 2nd one is usually longer than the 1st) over the last 14 days,
 * or 30 days if there are too few.
 */
export function predictNext(spans: Span[]): Prediction | null {
  const last = spans[spans.length - 1];
  if (!last) return null;
  let pos = 0;
  for (let i = spans.length - 1; i >= 0 && !spans[i].night; i--) pos++;
  const windows = wakeWindows(spans);
  let same = windows.filter((w) => w.pos === pos && w.t > last.e - 14 * DAY);
  if (same.length < 5) same = windows.filter((w) => w.pos === pos && w.t > last.e - 30 * DAY);
  if (same.length < 3) return null;
  const windowMs = median(same.map((w) => w.ms));
  const typical: number[] = [];
  for (let p = 0; p < 4; p++) {
    const l = windows.filter((w) => w.pos === p && w.t > last.e - 14 * DAY);
    if (l.length < 5) break;
    typical.push(median(l.map((w) => w.ms)));
  }
  return {
    at: last.e + windowMs,
    bedtime: same.filter((w) => w.toNight).length > same.length / 2,
    pos,
    windowMs,
    typical,
  };
}
