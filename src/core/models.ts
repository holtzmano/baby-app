export type EventType = 'sleep' | 'wake' | 'feed' | 'diaper' | 'note';

export interface EventDoc {
  id: string;
  babyId: string;         // MVP: always "default"
  type: EventType;
  tsMs: number;           // epoch ms
  meta?: {
    noteText?: string;
    durationMs?: number;  // for feed duration on stop
    diaperType?: 'wet' | 'dirty' | 'both';
  } | null;
  pendingSync?: 0 | 1;    // reserved for later
  deleted?: 0 | 1;        // reserved for later
  createdAtMs?: number;
  updatedAtMs?: number;
}
