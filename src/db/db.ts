// src/db/db.ts
import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

const DB_NAME = 'baby.db';

let _dbPromise: Promise<SQLiteDatabase> | null = null;
/** Lazily open the database once and reuse it. */
export function getDb(): Promise<SQLiteDatabase> {
  if (!_dbPromise) _dbPromise = SQLite.openDatabaseAsync(DB_NAME);
  return _dbPromise;
}

/** Single migration step definition. */
type Migration = {
  /** Target user_version after this migration completes. */
  to: number;
  /** Migration body (idempotent where possible). */
  up: (db: SQLiteDatabase) => Promise<void>;
};

/** Append future migrations here (to: 2, 3, …). Keep them additive/transactional. */
const MIGRATIONS: Migration[] = [
  {
    to: 1,
    up: async (db) => {
      // Durability/perf knobs
      await db.execAsync('PRAGMA journal_mode=WAL;');
      await db.execAsync('PRAGMA foreign_keys=ON;');

      // Base schema
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS events (
          id TEXT PRIMARY KEY,
          baby_id TEXT NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('sleep','wake','feed','diaper','note')),
          ts_ms INTEGER NOT NULL,
          -- JSON-encoded metadata for the event
          meta TEXT,
          pending_sync INTEGER NOT NULL DEFAULT 1,
          deleted INTEGER NOT NULL DEFAULT 0,
          created_at_ms INTEGER NOT NULL,
          updated_at_ms INTEGER NOT NULL
        );
      `);

      await db.execAsync(
        'CREATE INDEX IF NOT EXISTS idx_events_baby_ts ON events (baby_id, ts_ms DESC);'
      );
    },
  },

  // Example next migration (keep commented until you need it):
  // {
  //   to: 2,
  //   up: async (db) => {
  //     await db.execAsync(`ALTER TABLE events ADD COLUMN source TEXT NULL;`);
  //   },
  // },
];

async function getUserVersion(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  return row?.user_version ?? 0;
}

/** Run any pending migrations (transactionally), bumping PRAGMA user_version as we go. */
export async function migrate(): Promise<void> {
  const db = await getDb();
  const current = await getUserVersion(db);
  const pending = MIGRATIONS
    .filter((m) => m.to > current)
    .sort((a, b) => a.to - b.to);

  if (pending.length === 0) return;

  for (const m of pending) {
    await db.execAsync('BEGIN TRANSACTION;');
    try {
      await m.up(db);
      await db.execAsync(`PRAGMA user_version = ${m.to};`);
      await db.execAsync('COMMIT;');
    } catch (err) {
      await db.execAsync('ROLLBACK;');
      throw err;
    }
  }
}
