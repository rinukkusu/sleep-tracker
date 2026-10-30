import type { Kind } from './types';

export const MINUTE = 60_000;

export function startOfDay(d: Date | number | string): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Calendar-day arithmetic, safe across DST switches. */
export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function fmtDuration(ms: number): string {
  const m = Math.max(0, Math.floor(ms / MINUTE));
  const h = Math.floor(m / 60);
  return h ? `${h}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`;
}

export function fmtTimer(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function fmtTime(d: Date | string | number): string {
  return new Date(d).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function fmtDay(day: Date): string {
  const today = startOfDay(new Date());
  if (+day === +today) return 'Heute';
  if (+day === +addDays(today, -1)) return 'Gestern';
  return day.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

/** ISO string -> value for <input type="datetime-local"> in local time. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value: string): string {
  return new Date(value).toISOString();
}

/** Evening and night starts default to "night", daytime starts to "nap". */
export function defaultKind(d = new Date()): Kind {
  const h = d.getHours();
  return h >= 18 || h < 6 ? 'night' : 'nap';
}

export const kindLabel: Record<Kind, string> = { nap: 'Nickerchen', night: 'Nachtschlaf' };
export const kindIcon: Record<Kind, string> = { nap: '☀️', night: '🌙' };
