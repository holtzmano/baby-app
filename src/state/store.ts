import { create } from 'zustand';
import { EventDoc, EventType } from '../core/models';
import { insertEvent, listEventsToday, updateEventMeta, softDeleteEvent } from '../db/events.repo.sqlite';

type TimerState = { type: 'sleep' | 'feed'; startedAtMs: number } | undefined;

type Store = {
  events: EventDoc[];
  timer: TimerState;
  refreshToday: () => Promise<void>;
  logImmediate: (type: Exclude<EventType, 'note' | 'feed'>, meta?: EventDoc['meta']) => Promise<void>;
  saveNote: (text: string) => Promise<void>;
  startTimer: (type: 'sleep' | 'feed') => void;
  stopTimer: () => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  updateDiaper: (id: string, diaperType: 'wet' | 'dirty' | 'both') => Promise<void>;
  _init: () => Promise<void>; // bootstrap: initial refresh + midnight auto-refresh
};

const nowMs = () => Date.now();

// simple tap guard to prevent accidental duplicates
let lastTapAt = 0;
const TAP_GUARD_MS = 700;

function scheduleMidnightRefresh(refresh: () => Promise<void>) {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  const delay = Math.max(1000, next.getTime() - now.getTime());
  setTimeout(async () => {
    await refresh();
    scheduleMidnightRefresh(refresh);
  }, delay);
}

export const useStore = create<Store>((set, get) => ({
  events: [],
  timer: undefined,

  _init: async () => {
    await get().refreshToday();
    scheduleMidnightRefresh(get().refreshToday);
  },

  refreshToday: async () => {
    const events = await listEventsToday();
    set({ events });
  },

  logImmediate: async (type, meta) => {
    const now = nowMs();
    if (now - lastTapAt < TAP_GUARD_MS) return;
    lastTapAt = now;

    await insertEvent({
      babyId: 'default',
      type,
      tsMs: now,
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
        .catch((err) => {
          console.error('Failed to insert sleep event or refresh:', err);
        });
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

  deleteEvent: async (id: string) => {
    await softDeleteEvent(id);
    await get().refreshToday();
  },

  updateDiaper: async (id, diaperType) => {
    await updateEventMeta(id, { diaperType });
    await get().refreshToday();
  },
}));
