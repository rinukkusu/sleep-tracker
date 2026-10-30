import { addDays } from './time';
import type { Kind, Sleep } from './types';

export interface Segment {
  sleep: Sleep;
  /** 0..1 position within the day */
  from: number;
  to: number;
}

export interface DayStats {
  segments: Segment[];
  total: number;
  byKind: Record<Kind, number>;
  naps: number;
}

export function endMs(s: Sleep, now: number): number {
  return s.end ? Date.parse(s.end) : now;
}

/** Clips all sessions to one calendar day; sessions across midnight are split. */
export function dayStats(sleeps: Sleep[], day: Date, now: number): DayStats {
  const dayStart = +day;
  const dayEnd = +addDays(day, 1);
  const len = dayEnd - dayStart;
  const stats: DayStats = { segments: [], total: 0, byKind: { nap: 0, night: 0 }, naps: 0 };

  for (const s of sleeps) {
    const a = Math.max(Date.parse(s.start), dayStart);
    const b = Math.min(endMs(s, now), dayEnd);
    if (b <= a) continue;
    stats.segments.push({ sleep: s, from: (a - dayStart) / len, to: (b - dayStart) / len });
    stats.total += b - a;
    stats.byKind[s.kind] += b - a;
    if (s.kind === 'nap') stats.naps++;
  }
  stats.segments.sort((x, y) => x.from - y.from);
  return stats;
}
