import { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, View, Text, Pressable, TextInput, FlatList, StyleSheet } from 'react-native';
import { migrate } from '../src/db/db';        // relative import
import { useStore } from '../src/state/store'; // relative import
import type { EventDoc, EventType } from '../src/core/models'; // relative import


const BigButton = ({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    hitSlop={8}
    style={({ pressed }) => [styles.button, disabled ? styles.buttonDisabled : (pressed ? styles.buttonPressed : null)]}
    accessibilityRole="button"
    accessibilityLabel={label}
  >
    <Text style={styles.buttonText}>{label}</Text>
  </Pressable>
);

export default function IndexScreen() {
  const { events, timer, refreshToday, startTimer, stopTimer, logImmediate, saveNote } = useStore();
  const [note, setNote] = useState('');

  useEffect(() => { migrate(); refreshToday(); }, [refreshToday]);

  const sorted = useMemo(
    () => events.slice().sort((a: EventDoc, b: EventDoc) => b.tsMs - a.tsMs),
    [events]
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Baby Tracker 👶</Text>

        {!timer && (
          <View style={styles.stack}>
            <BigButton label="Start Sleep 😴" onPress={() => startTimer('sleep')} />
            <BigButton label="Start Feed 🍼" onPress={() => startTimer('feed')} />
            <BigButton label="Log Diaper 🧷" onPress={() => logImmediate('diaper')} />
            <BigButton label="Log Wake 🌅" onPress={() => logImmediate('wake')} />
          </View>
        )}

        {timer && (
          <View style={styles.stack}>
            <Text style={styles.timerText}>
              {timer.type === 'sleep' ? 'Sleeping… ' : 'Feeding… '}
              {Math.floor((Date.now() - timer.startedAtMs) / 1000)}s
            </Text>
            <BigButton label="Stop" onPress={stopTimer} />
          </View>
        )}

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
          <BigButton label="Save Note" onPress={() => { if (note.trim()) { saveNote(note); setNote(''); } }} />
        </View>

        {/* Timeline */}
        <Text style={styles.sectionTitle}>Today</Text>
        <FlatList<EventDoc>
          data={sorted}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.rowTitle}>{icon(item.type)} {item.type.toUpperCase()}</Text>
              <Text style={styles.rowSub}>{new Date(item.tsMs).toLocaleTimeString()}</Text>
              {item.type === 'note' && item.meta?.noteText ? <Text style={styles.rowNote}>{item.meta.noteText}</Text> : null}
              {item.type === 'feed' && typeof item.meta?.durationMs === 'number' ? (
                <Text style={styles.rowNote}>Duration: {Math.round(item.meta.durationMs / 1000)}s</Text>
              ) : null}
            </View>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

function icon(t: EventType) {
  switch (t) {
    case 'sleep': return '😴';
    case 'wake': return '🌅';
    case 'feed': return '🍼';
    case 'diaper': return '🧷';
    case 'note': return '📝';
    default: return '•';
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'white' },
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 16 },
  stack: { marginBottom: 8 },
  button: { backgroundColor: '#111827', paddingVertical: 16, paddingHorizontal: 16, borderRadius: 16, marginBottom: 12 },
  buttonPressed: { opacity: 0.8 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: 'white', fontSize: 18, textAlign: 'center' },
  timerText: { marginBottom: 8, fontSize: 16 },
  noteBox: { marginTop: 8, marginBottom: 12 },
  noteLabel: { fontSize: 16, marginBottom: 6 },
  noteInput: { borderWidth: 1, borderColor: '#e5e7eb', padding: 12, borderRadius: 12, marginBottom: 8, fontSize: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  row: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowSub: { color: '#6b7280' },
  rowNote: { marginTop: 4 },
});
