// src/db/events.repo.sqlite.ts
import { getDb } from './db';
import type { EventDoc, EventType } from '../core/models';

type DBRow = {
  id: string;
  baby_id: string;
  type: string;
  ts_ms: number;
  meta: string | null;   // DB can hold NULL
  pending_sync: number;  // 0/1
  deleted: number;       // 0/1
  created_at_ms: number;
  updated_at_ms: number;
};

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

type EventMeta = NonNullable<EventDoc['meta']>;

function startOfLocalDayMs(when: number) {
  const d = new Date(when);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function parseMeta(s: string): EventDoc['meta'] {
  try {
    const obj = JSON.parse(s);
    return obj;
  } catch {
    return undefined;
  }
}

/** Insert a single event and return its generated id. */
export async function insertEvent(
  e: Omit<EventDoc, 'id' | 'createdAtMs' | 'updatedAtMs' | 'pendingSync' | 'deleted'>
): Promise<string> {
  const db = await getDb();
  const id = uid();
  const now = Date.now();

  // DB stores NULL when meta is undefined
  const metaJson: string | null = e.meta === undefined ? null : JSON.stringify(e.meta);

  await db.runAsync(
    `INSERT INTO events (id,baby_id,type,ts_ms,meta,pending_sync,deleted,created_at_ms,updated_at_ms)
     VALUES (?,?,?,?,?,?,0,?,?)`,
    [id, e.babyId, e.type, e.tsMs, metaJson, 1, now, now]
  );

  return id;
}

/** Patch/merge meta JSON and update updated_at_ms. */
export async function updateEventMeta(eventId: string, patch: Partial<EventMeta>): Promise<void> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ meta: string | null }>(
    'SELECT meta FROM events WHERE id = ?',
    [eventId]
  );
  const current: EventMeta = row?.meta ? (JSON.parse(row.meta) as EventMeta) : {};
  const next: EventMeta = { ...current, ...patch };
  await db.runAsync('UPDATE events SET meta = ?, updated_at_ms = ? WHERE id = ?', [
    JSON.stringify(next),
    Date.now(),
    eventId,
  ]);
}

/** List events within [fromMs, toMs), newest first. */
export async function listEventsRange(
  babyId: string,
  fromMs: number,
  toMs: number
): Promise<EventDoc[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<DBRow>(
    `SELECT * FROM events
     WHERE baby_id = ? AND deleted = 0 AND ts_ms >= ? AND ts_ms < ?
     ORDER BY ts_ms DESC`,
    [babyId, fromMs, toMs]
  );

  return rows.map<EventDoc>((r) => ({
    id: r.id,
    babyId: r.baby_id,
    type: r.type as EventType,
    tsMs: r.ts_ms,
    meta: r.meta ? parseMeta(r.meta) : undefined, // NULL → undefined
    pendingSync: r.pending_sync === 1,
    deleted: r.deleted === 1,
    createdAtMs: r.created_at_ms,
    updatedAtMs: r.updated_at_ms,
  }));
}

/** List today's events (>= local midnight, < next midnight), newest first. */
export async function listEventsToday(babyId = 'default'): Promise<EventDoc[]> {
  const from = startOfLocalDayMs(Date.now());
  const to = from + 24 * 60 * 60 * 1000;
  return listEventsRange(babyId, from, to);
}

/** Soft-delete an event by id. */
export async function softDeleteEvent(eventId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE events SET deleted = 1, updated_at_ms = ? WHERE id = ?', [
    Date.now(),
    eventId,
  ]);
}

/** List all pending-to-sync events for a baby, oldest first. */
export async function listPendingEvents(babyId = 'default'): Promise<EventDoc[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<DBRow>(
    `SELECT * FROM events WHERE baby_id = ? AND deleted = 0 AND pending_sync = 1 ORDER BY ts_ms ASC`,
    [babyId]
  );
  return rows.map((r) => ({
    id: r.id,
    babyId: r.baby_id,
    type: r.type as EventType,
    tsMs: r.ts_ms,
    meta: r.meta ? parseMeta(r.meta) : undefined,
    pendingSync: r.pending_sync === 1,
    deleted: r.deleted === 1,
    createdAtMs: r.created_at_ms,
    updatedAtMs: r.updated_at_ms,
  }));
}

/** Mark a set of events as synced by id. No-op if ids is empty. */
export async function markSynced(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const db = await getDb();
  const now = Date.now();
  const placeholders = ids.map(() => '?').join(',');
  await db.runAsync(
    `UPDATE events SET pending_sync = 0, updated_at_ms = ? WHERE id IN (${placeholders})`,
    [now, ...ids]
  );
}