import { create } from 'zustand';
import { EventDoc, EventType } from '../core/models'; // use relative import unless you set up tsconfig paths
import { insertEvent, listEventsToday } from '../db/events.repo.sqlite';

type TimerState = { type: 'sleep' | 'feed'; startedAtMs: number } | undefined;

type Store = {
  events: EventDoc[];
  timer: TimerState;
  refreshToday: () => Promise<void>;
  logImmediate: (type: Exclude<EventType, 'note' | 'feed'>, meta?: EventDoc['meta']) => Promise<void>;
  saveNote: (text: string) => Promise<void>;
  startTimer: (type: 'sleep' | 'feed') => void;
  stopTimer: () => Promise<void>;
};

const nowMs = () => Date.now();

export const useStore = create<Store>((set, get) => ({
  events: [],
  timer: undefined,

  refreshToday: async () => {
    const events = await listEventsToday();
    set({ events });
  },

  logImmediate: async (type, meta) => {
    await insertEvent({
      babyId: 'default',
      type,
      tsMs: nowMs(),
      meta, // forward directly; undefined is fine
    });
    await get().refreshToday();
  },

  saveNote: async (text: string) => {
    if (!text.trim()) return;
    await insertEvent({
      babyId: 'default',
      type: 'note',
      tsMs: nowMs(),
      meta: { noteText: text.trim() },
    });
    await get().refreshToday();
  },

  startTimer: (type) => {
    const startedAtMs = nowMs();
    set({ timer: { type, startedAtMs } });
    if (type === 'sleep') {
      insertEvent({ babyId: 'default', type: 'sleep', tsMs: startedAtMs })
        .then(() => get().refreshToday())
        .catch(() => { /* noop for MVP */ });
    }
  },

  stopTimer: async () => {
    const t = get().timer;
    if (!t) return;

    if (t.type === 'sleep') {
      await insertEvent({ babyId: 'default', type: 'wake', tsMs: nowMs() });
    } else {
      const durationMs = Math.max(0, nowMs() - t.startedAtMs);
      await insertEvent({
        babyId: 'default',
        type: 'feed',
        tsMs: nowMs(),
        meta: { durationMs },
      });
    }

    set({ timer: undefined });
    await get().refreshToday();
  },
}));
