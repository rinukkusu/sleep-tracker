export type Kind = 'nap' | 'night';

export interface Sleep {
  id: string;
  /** ISO timestamp */
  start: string;
  /** ISO timestamp, null while she is still asleep */
  end: string | null;
  kind: Kind;
  note: string;
}
