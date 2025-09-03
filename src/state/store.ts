// src/state/store.ts
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EventDoc, EventType } from '../core/models';
import { insertEvent, listEventsToday, updateEventMeta, softDeleteEvent } from '../db/events.repo.sqlite';

type RunningTimer = { type: 'sleep' | 'feed'; startedAtMs: number };
type TimerState = RunningTimer | undefined;

type Store = {
  events: EventDoc[];
  timer: TimerState;
  refreshToday: () => Promise<void>;
  logImmediate: (type: Exclude<EventType, 'note' | 'feed'>, meta?: EventDoc['meta']) => Promise<void>;
  saveNote: (text: string) => Promise<void>;
  startTimer: (type: 'sleep' | 'feed') => Promise<void>;
  stopTimer: () => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  updateDiaper: (id: string, diaperType: 'wet' | 'dirty' | 'both') => Promise<void>;
  _init: () => Promise<void>;
};

const nowMs = () => Date.now();
const TIMER_KEY = '@babyapp/timer';

// simple tap guard
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

async function loadTimer(): Promise<RunningTimer | undefined> {
  try {
    const s = await AsyncStorage.getItem(TIMER_KEY);
    return s ? (JSON.parse(s) as RunningTimer) : undefined;
  } catch {
    return undefined;
  }
}
async function saveTimer(t?: RunningTimer) {
  try {
    if (!t) await AsyncStorage.removeItem(TIMER_KEY);
    else await AsyncStorage.setItem(TIMER_KEY, JSON.stringify(t));
  } catch {
    // ignore
  }
}

export const useStore = create<Store>((set, get) => ({
  events: [],
  timer: undefined,

  _init: async () => {
    // recover any running timer from storage
    const t = await loadTimer();
    if (t) set({ timer: t });

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
      meta,
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

  startTimer: async (type) => {
    const startedAtMs = nowMs();
    const running: RunningTimer = { type, startedAtMs };
    set({ timer: running });
    await saveTimer(running);

    if (type === 'sleep') {
      // write the sleep start immediately (append-only)
      insertEvent({ babyId: 'default', type: 'sleep', tsMs: startedAtMs })
        .then(() => get().refreshToday())
        .catch((err) => console.error('Failed to insert sleep start:', err));
    }
  },

  stopTimer: async () => {
    const t = get().timer;
    if (!t) return;

    try {
      if (t.type === 'sleep') {
        const end = nowMs();
        const durationMs = Math.max(0, end - t.startedAtMs);

        // record wake with duration + intervalStartMs so stats can slice across days
        await insertEvent({
          babyId: 'default',
          type: 'wake',
          tsMs: end,
          meta: { durationMs, intervalStartMs: t.startedAtMs },
        });
      } else {
        // feed
        const durationMs = Math.max(0, nowMs() - t.startedAtMs);
        await insertEvent({
          babyId: 'default',
          type: 'feed',
          tsMs: nowMs(),
          meta: { durationMs },
        });
      }
    } finally {
      set({ timer: undefined });
      await saveTimer(undefined);
      await get().refreshToday();
    }
  },

  deleteEvent: async (id) => {
    await softDeleteEvent(id);
    await get().refreshToday();
  },

  updateDiaper: async (id, diaperType) => {
    await updateEventMeta(id, { diaperType });
    await get().refreshToday();
  },
}));
