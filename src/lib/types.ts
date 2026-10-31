export type Kind = 'nap' | 'night';

/** She was briefly awake during a sleep; counts as part of the same sleep. */
export interface Pause {
  /** ISO timestamp */
  start: string;
  /** ISO timestamp, null while the pause is still going on */
  end: string | null;
}

export interface Sleep {
  id: string;
  /** ISO timestamp */
  start: string;
  /** ISO timestamp, null while she is still asleep */
  end: string | null;
  kind: Kind;
  note: string;
  pauses: Pause[];
}
