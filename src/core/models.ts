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
  };
  pendingSync?: boolean;    // reserved for later
  deleted?: boolean;        // reserved for later
  createdAtMs?: number;
  updatedAtMs?: number;
}
