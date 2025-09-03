// src/core/models.ts
export type EventType = 'sleep' | 'wake' | 'feed' | 'diaper' | 'note';

export interface EventDoc {
  id: string;
  babyId: string;         // MVP: always "default"
  type: EventType;
  tsMs: number;           // epoch ms
  meta?: {
    noteText?: string;
    durationMs?: number;         // for feed duration; and for sleep duration on wake
    diaperType?: 'wet' | 'dirty' | 'both';
    intervalStartMs?: number;    // NEW: when meta.durationMs refers to an interval (sleep), this is the start
  };
  pendingSync?: boolean;
  deleted?: boolean;
  createdAtMs?: number;
  updatedAtMs?: number;
}
