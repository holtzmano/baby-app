import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { Link } from 'expo-router';
import { listEventsRange } from '../src/db/events.repo.sqlite';
import type { EventDoc } from '../src/core/models';

const MS_DAY = 24 * 60 * 60 * 1000;
const dayStart = (ms: number) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return +d; };

type Row = {
  date: Date;
  sleepMin: number;
  feeds: number;
  feedAvgMin: number;
  wet: number; dirty: number; both: number;
};

export default function Stats() {
  const [days, setDays] = useState<Row[]>([]);
  const [hourly, setHourly] = useState<number[]>(Array(24).fill(0));

  useEffect(() => { (async () => {
    const end = dayStart(Date.now()) + MS_DAY;
    const start = end - 7 * MS_DAY;

    // Pull last 7d events
    const all = await listEventsRange('default', start, end);

    // Group per day
    const byDay = new Map<number, EventDoc[]>();
    for (let d = start; d < end; d += MS_DAY) byDay.set(d, []);
    all.forEach(e => byDay.get(dayStart(e.tsMs))?.push(e));

    // Build rows (pair sleep↔wake inside the day; carry-in/out handled simply)
    const rows: Row[] = [];
    const hourlyBuckets = Array(24).fill(0) as number[];

    for (const [k, evts] of byDay.entries()) {
      // sort ascending within the day
      evts.sort((a, b) => a.tsMs - b.tsMs);
      const day0 = k;
      const day1 = k + MS_DAY;

      // Sleep total:
      // 1) if day starts with a 'wake' without a same-day 'sleep' before it, assume asleep since day start
      // 2) then pair sleep→wake inside the day
      // 3) if day ends still asleep, count until day end
      let sleepMin = 0;
      let asleepAt: number | null = null;

      // seed carry-in: if the first event is a wake, assume asleep since day0
      if (evts.length && evts[0].type === 'wake') {
        asleepAt = day0;
        sleepMin += Math.max(0, (evts[0].tsMs - day0) / 60000);
        asleepAt = null;
      }
      // pair inside day
      for (const e of evts) {
        if (e.type === 'sleep') {
          asleepAt = e.tsMs;
        } else if (e.type === 'wake' && asleepAt != null) {
          const dur = Math.max(0, e.tsMs - asleepAt);
          sleepMin += dur / 60000;
          asleepAt = null;

          // hourly bucket: attribute to the wake hour (simple heuristic)
          const hr = new Date(e.tsMs).getHours();
          hourlyBuckets[hr] += dur;
        }
      }
      // carry-out: still sleeping at day end
      if (asleepAt != null) {
        const dur = Math.max(0, day1 - asleepAt);
        sleepMin += dur / 60000;
        const hr = new Date(day1 - 1).getHours();
        hourlyBuckets[hr] += dur;
      }

      // Feeds
      const feeds = evts.filter(e => e.type === 'feed');
      const feedTotalMs = feeds.reduce((s, f) => s + (f.meta?.durationMs ?? 0), 0);
      const feedAvgMin = feeds.length ? Math.round((feedTotalMs / feeds.length) / 60000) : 0;

      // Diapers
      const wet = evts.filter(e => e.type === 'diaper' && (e.meta?.diaperType ?? 'wet') === 'wet').length;
      const dirty = evts.filter(e => e.type === 'diaper' && e.meta?.diaperType === 'dirty').length;
      const both = evts.filter(e => e.type === 'diaper' && e.meta?.diaperType === 'both').length;

      rows.push({ date: new Date(k), sleepMin: Math.round(sleepMin), feeds: feeds.length, feedAvgMin, wet, dirty, both });
    }

    rows.sort((a, b) => a.date.getTime() - b.date.getTime()); // oldest first
    setDays(rows);

    // finalize hourly heatline across 7d
    setHourly(hourlyBuckets);
  })(); }, []);

  const heatline = useMemo(() => {
    const max = Math.max(1, ...hourly);
    const blocks = ['·', '▁', '▂', '▃', '▄', '▅', '▆', '▇']; // 0..7
    const scaled = hourly.map(v => blocks[Math.min(7, Math.round((v / max) * 7))]).join('');
    return scaled;
  }, [hourly]);

  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <Text style={s.h1}>Weekly Stats</Text>
        <Link href="/" style={s.link}>← Home</Link>
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
            <Text>🧷 Diapers - wet {item.wet}, 💩 dirty {item.dirty}, both {item.both}</Text>
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
