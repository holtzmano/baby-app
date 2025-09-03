// src/core/time.ts
export const MS_MIN = 60_000;
export const MS_HOUR = 60 * MS_MIN;
export const MS_DAY = 24 * MS_HOUR;

export function startOfLocalDayMs(ms: number) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return +d;
}

export function daySpan(ms: number): [number, number] {
  const start = startOfLocalDayMs(ms);
  return [start, start + MS_DAY];
}

/** Return [overlapStart, overlapEnd] with [a0,a1) ∩ [b0,b1), or null if none. */
export function intervalOverlap(a0: number, a1: number, b0: number, b1: number): [number, number] | null {
  const s = Math.max(a0, b0);
  const e = Math.min(a1, b1);
  return e > s ? [s, e] : null;
}

/** Add milliseconds of [s,e) into 24 buckets by hour. Simple split at hour boundaries. */
export function accumulateHourly(buckets: number[], s: number, e: number) {
  let cur = s;
  while (cur < e) {
    const hourEnd = startOfLocalDayMs(cur) + (new Date(cur).getHours() + 1) * MS_HOUR;
    const chunkEnd = Math.min(hourEnd, e);
    const hr = new Date(cur).getHours();
    buckets[hr] += (chunkEnd - cur);
    cur = chunkEnd;
  }
}
