// app/stats.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { Link } from 'expo-router';
import { listEventsRange } from '../src/db/events.repo.sqlite';
import type { EventDoc } from '../src/core/models';
import { MS_DAY, MS_MIN, accumulateHourly, daySpan, intervalOverlap, startOfLocalDayMs } from '../src/core/time';

type Row = {
  date: Date;
  sleepMin: number;
  feeds: number;
  feedAvgMin: number;
  wet: number;
  dirty: number;
  both: number;
};

export default function Stats() {
  const [days, setDays] = useState<Row[]>([]);
  const [hourly, setHourly] = useState<number[]>(Array(24).fill(0));

  useEffect(() => {
    (async () => {
      const end = startOfLocalDayMs(Date.now()) + MS_DAY;
      const start = end - 7 * MS_DAY;

      const all = await listEventsRange('default', start, end);

      // day buckets
      const byDay = new Map<number, EventDoc[]>();
      for (let d = start; d < end; d += MS_DAY) byDay.set(d, []);
      all.forEach((e) => byDay.get(startOfLocalDayMs(e.tsMs))?.push(e));

      const rows: Row[] = [];
      const hourlyBuckets = Array(24).fill(0) as number[];

      for (const [k, evts] of byDay.entries()) {
        const [d0, d1] = [k, k + MS_DAY];
        // ensure stable order
        evts.sort((a, b) => a.tsMs - b.tsMs);

        // Sleep minutes: use wake.meta.intervalStartMs when present; otherwise fall back to (wake.ts - duration)
        let sleepMs = 0;
        for (const w of evts) {
          if (w.type !== 'wake') continue;
          const endMs = w.tsMs;
          const startMs =
            typeof w.meta?.intervalStartMs === 'number'
              ? w.meta.intervalStartMs
              : typeof w.meta?.durationMs === 'number'
              ? endMs - w.meta.durationMs
              : undefined;
          if (typeof startMs !== 'number') continue;

          // slice overlap with [d0,d1)
          const ov = intervalOverlap(startMs, endMs, d0, d1);
          if (ov) {
            const [s, e] = ov;
            sleepMs += e - s;
            // hourly heatline across the full interval (not only overlap, but it’s fine to use overlap too)
            accumulateHourly(hourlyBuckets, s, e);
          }
        }

        // Feeds
        const feeds = evts.filter((e) => e.type === 'feed');
        const feedTotalMs = feeds.reduce((sum, f) => sum + (f.meta?.durationMs ?? 0), 0);
        const feedAvgMin = feeds.length ? Math.round((feedTotalMs / feeds.length) / MS_MIN) : 0;

        // Diapers
        const wet = evts.filter((e) => e.type === 'diaper' && (e.meta?.diaperType ?? 'wet') === 'wet').length;
        const dirty = evts.filter((e) => e.type === 'diaper' && e.meta?.diaperType === 'dirty').length;
        const both = evts.filter((e) => e.type === 'diaper' && e.meta?.diaperType === 'both').length;

        rows.push({
          date: new Date(k),
          sleepMin: Math.round(sleepMs / MS_MIN),
          feeds: feeds.length,
          feedAvgMin,
          wet,
          dirty,
          both,
        });
      }

      rows.sort((a, b) => a.date.getTime() - b.date.getTime());
      setDays(rows);
      setHourly(hourlyBuckets);
    })();
  }, []);

  const heatline = useMemo(() => {
    const max = Math.max(1, ...hourly);
    const blocks = ['·', '▁', '▂', '▃', '▄', '▅', '▆', '▇'];
    return hourly
      .map((v) => {
        const idx = Math.min(7, Math.round((v / max) * 7));
        return blocks[idx];
      })
      .join('');
  }, [hourly]);

  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <Text style={s.h1}>Weekly Stats</Text>
        <Link href="/" style={s.link}>
          ← Home
        </Link>
      </View>

      <View style={s.heat}>
        <Text style={s.heatTitle}>Sleep by hour (7d)</Text>
        <Text style={s.heatLine}>{heatline}</Text>
        <Text style={s.heatHours}>00·······06·······12·······18·······23</Text>
      </View>

      <FlatList
        data={days}
        keyExtractor={(r) => r.date.toISOString()}
        renderItem={({ item }) => (
          <View style={s.card}>
            <Text style={s.day}>{item.date.toDateString()}</Text>
            <Text>🛌 Sleep: {Math.floor(item.sleepMin / 60)}h {item.sleepMin % 60}m</Text>
            <Text>🍼 Feeds: {item.feeds} (avg {item.feedAvgMin}m)</Text>
            <Text>🧷 Diapers — wet {item.wet}, 💩 dirty {item.dirty}, both {item.both}</Text>
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 16, backgroundColor: '#fff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  h1: { fontSize: 24, fontWeight: '800' },
  link: { fontWeight: '700' },
  heat: { paddingVertical: 8, marginBottom: 8 },
  heatTitle: { fontWeight: '700', marginBottom: 4 },
  heatLine: { fontFamily: 'monospace' as any, letterSpacing: 1 },
  heatHours: { color: '#6b7280', fontSize: 12, marginTop: 2, fontFamily: 'monospace' as any },
  card: { padding: 12, borderWidth: 1, borderColor: '#eee', borderRadius: 12, marginTop: 10 },
  day: { fontWeight: '700', marginBottom: 4 },
});
