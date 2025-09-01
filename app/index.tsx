import { useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  Pressable,
  TextInput,
  FlatList,
  StyleSheet,
  ListRenderItem,
  PressableStateCallbackType,
  Alert,
} from 'react-native';
import { migrate } from '../src/db/db';
import { useStore } from '../src/state/store';
import type { EventDoc, EventType } from '../src/core/models';
import { Link } from 'expo-router';

const BigButton = ({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    hitSlop={8}
    style={({ pressed }: PressableStateCallbackType) => [
      styles.button,
      disabled ? styles.buttonDisabled : pressed ? styles.buttonPressed : null,
    ]}
    accessibilityRole="button"
    accessibilityLabel={label}
  >
    <Text style={styles.buttonText}>{label}</Text>
  </Pressable>
);

// Floating pill that keeps counting while the app stays usable
function RunningPill() {
  const { timer, stopTimer } = useStore();
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!timer) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [timer]);
  if (!timer) return null;
  const secs = Math.floor((Date.now() - timer.startedAtMs) / 1000);
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText}>
        {timer.type === 'sleep' ? 'Sleeping' : 'Feeding'} · {secs}s
      </Text>
      <Pressable onPress={stopTimer} style={styles.pillStop}>
        <Text style={styles.pillStopTxt}>Stop</Text>
      </Pressable>
    </View>
  );
}

export default function IndexScreen() {
  const { events, timer, refreshToday, startTimer, stopTimer, logImmediate, saveNote, deleteEvent, updateDiaper } = useStore();
  const [note, setNote] = useState('');

  // Boot: run DB migrations once, then init store (midnight auto-refresh + initial refresh)
  useEffect(() => {
    (async () => {
      await migrate();
      await useStore.getState()._init();
    })();
  }, []);

  const sorted = useMemo(
    () => events.slice().sort((a: EventDoc, b: EventDoc) => b.tsMs - a.tsMs),
    [events]
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text style={styles.title}>Baby Tracker 👶</Text>
          <Link href="/stats" style={{ fontWeight: '700' }}>📈 Weekly</Link>
        </View>

        {/* Two-column action layout (always visible; timer pill floats) */}
        <View style={styles.grid}>
          <View style={styles.col}>
            <BigButton label="Start Sleep 😴" onPress={() => startTimer('sleep')} />
            <BigButton label="Log Wake 🌅" onPress={() => logImmediate('wake')} />
          </View>
          <View style={styles.col}>
            <BigButton label="Start Feed 🍼" onPress={() => startTimer('feed')} />
            <BigButton
              label="Log Diaper 🧷"
              onPress={() => logImmediate('diaper', { diaperType: 'wet' })}
            />
          </View>
        </View>

        {/* Notes */}
        <View style={styles.noteBox}>
          <Text style={styles.noteLabel}>Quick Note 📝</Text>
          <TextInput
            placeholder="Type a thought…"
            value={note}
            onChangeText={setNote}
            style={styles.noteInput}
            multiline
          />
          <BigButton
            label="Save Note"
            onPress={() => {
              if (note.trim()) {
                saveNote(note);
                setNote('');
              }
            }}
          />
        </View>

        {/* Timeline */}
        <Text style={styles.sectionTitle}>Today</Text>
        <FlatList<EventDoc>
          data={sorted}
          keyExtractor={(i: EventDoc) => i.id}
          renderItem={({ item }: Parameters<ListRenderItem<EventDoc>>[0]) => (
            <Pressable
              onLongPress={() =>
                Alert.alert('Delete', 'Remove this entry?', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => useStore.getState().deleteEvent(item.id),
                  },
                ])
              }
            >
              <View style={styles.row}>
                <Text style={styles.rowTitle}>
                  {icon(item.type)} {item.type.toUpperCase()}
                </Text>
                <Text style={styles.rowSub}>{new Date(item.tsMs).toLocaleTimeString()}</Text>

                {/* Note text */}
                {item.type === 'note' && item.meta?.noteText ? (
                  <Text style={styles.rowNote}>{item.meta.noteText}</Text>
                ) : null}

                {/* Feed duration */}
                {item.type === 'feed' && typeof item.meta?.durationMs === 'number' ? (
                  <Text style={styles.rowNote}>Duration: {Math.round(item.meta.durationMs / 1000)}s</Text>
                ) : null}

                {/* Wake shows how long slept (if we stored duration on wake in future PR) */}
                {item.type === 'wake' && typeof item.meta?.durationMs === 'number' ? (
                  <Text style={styles.rowNote}>
                    Slept {Math.floor(item.meta.durationMs / 60000)}m
                  </Text>
                ) : null}

                {/* Diaper toggle: wet → dirty → both → wet */}
                {item.type === 'diaper' && (
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 4, alignItems: 'center' }}>
                    <Text style={styles.rowNote}>
                      {item.meta?.diaperType ? item.meta.diaperType : 'wet'}
                    </Text>
                    <Pressable
                      onPress={() => {
                        const next =
                          item.meta?.diaperType === 'dirty'
                            ? 'both'
                            : item.meta?.diaperType === 'both'
                            ? 'wet'
                            : 'dirty';
                        useStore.getState().updateDiaper(item.id, next as 'wet' | 'dirty' | 'both');
                      }}
                      style={styles.diaperToggle}
                    >
                      <Text>
                        {item.meta?.diaperType === 'dirty' || item.meta?.diaperType === 'both'
                          ? '💩'
                          : '◻️'}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </Pressable>
          )}
          ListFooterComponent={<View style={{ height: 100 }} />}
        />
      </View>

      {/* Floating timer pill above the bottom */}
      <RunningPill />
    </SafeAreaView>
  );
}

function icon(t: EventType) {
  switch (t) {
    case 'sleep':
      return '😴';
    case 'wake':
      return '🌅';
    case 'feed':
      return '🍼';
    case 'diaper':
      return '🧷';
    case 'note':
      return '📝';
    default:
      return '•';
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'white' },
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 12 },

  // Actions grid
  grid: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  col: { flex: 1, gap: 12 },

  // Buttons
  button: {
    backgroundColor: '#111827',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: 'white', fontSize: 18, textAlign: 'center' },

  // Notes
  noteBox: { marginTop: 8, marginBottom: 12 },
  noteLabel: { fontSize: 16, marginBottom: 6 },
  noteInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    fontSize: 16,
  },

  // Timeline
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  row: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowSub: { color: '#6b7280' },
  rowNote: { marginTop: 4 },

  // Diaper toggle
  diaperToggle: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
  },

  // Floating pill
  pill: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 80,
    backgroundColor: '#111',
    padding: 12,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 4,
  },
  pillText: { color: '#fff', fontWeight: '700' },
  pillStop: { backgroundColor: '#b00020', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  pillStopTxt: { color: '#fff', fontWeight: '700' },
});
