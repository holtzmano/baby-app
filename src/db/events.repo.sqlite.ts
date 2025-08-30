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

/** List today's events (midnight → now) for the given baby, newest first. */
export async function listEventsToday(babyId = 'default'): Promise<EventDoc[]> {
  const db = await getDb();
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const rows = await db.getAllAsync<DBRow>(
    `SELECT * FROM events
     WHERE baby_id = ? AND deleted = 0 AND ts_ms >= ?
     ORDER BY ts_ms DESC`,
    [babyId, start.getTime()]
  );

  return rows.map<EventDoc>((r) => ({
    id: r.id,
    babyId: r.baby_id,
    type: r.type as EventType,
    tsMs: r.ts_ms,
    // Map DB NULL → undefined to satisfy EventDoc.meta type
    meta: r.meta ? parseMeta(r.meta) : undefined,
    pendingSync: r.pending_sync === 1,
    deleted: r.deleted === 1,
    createdAtMs: r.created_at_ms,
    updatedAtMs: r.updated_at_ms,
  }));
}

function parseMeta(s: string): EventDoc['meta'] {
  try {
    const obj = JSON.parse(s);
    // If DB accidentally contains "null" as a stringified value, normalize to undefined
    return obj;
  } catch {
    return undefined;
  }
}
