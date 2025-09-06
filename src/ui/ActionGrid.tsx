import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { BigActionButton } from './BigActionButton';
import { useStore } from '../state/store';

/**
 * UI labels vs. underlying event types:
 * - UI says "Eat" but DB type stays "feed" (no migration).
 */
export function ActionGrid() {
  const { timer, startTimer, stopTimer, logImmediate } = useStore();

  const isSleeping = timer?.type === 'sleep';
  const isFeeding = timer?.type === 'feed';

  const sleepSublabel = isSleeping ? 'Stop Sleep' : 'Start Sleep';
  const eatSublabel = isFeeding ? 'Stop' : 'Start';

  const onPressSleep = () => {
    if (isSleeping) {
      // existing store: stopTimer() will write a "wake" event with duration + intervalStart
      stopTimer();
    } else {
      startTimer('sleep');
    }
  };

  const onPressWake = () => {
    // If currently sleeping, Wake should stop the running sleep interval.
    if (isSleeping) stopTimer();
    else logImmediate('wake');
  };

  const onPressEat = () => {
    if (isFeeding) stopTimer();
    else startTimer('feed');
  };

  const onPressDiaper = () => {
    // Default to 'wet' when logging from the big button. User can toggle on the timeline.
    logImmediate('diaper', { diaperType: 'wet' });
  };

  // Disable conflicting actions while timers run (prevents accidental overlaps).
  const disabled = useMemo(
    () => ({
      sleep: isFeeding,
      wake: false,
      eat: isSleeping,
      diaper: false,
    }),
    [isSleeping, isFeeding]
  );

  return (
    <View style={styles.grid}>
      <View style={styles.row}>
        <BigActionButton
          label="Eat"
          sublabel={eatSublabel}
          icon="baby-bottle-outline"
          onPress={onPressEat}
          disabled={disabled.eat}
          testID="btn-eat"
          accessibilityHint={isFeeding ? 'Stop feeding timer' : 'Start feeding timer'}
        />
        <BigActionButton
          label="Sleep"
          sublabel={sleepSublabel}
          icon="weather-night"
          onPress={onPressSleep}
          disabled={disabled.sleep}
          testID="btn-sleep"
          accessibilityHint={isSleeping ? 'Stop sleep and log wake' : 'Start sleep timer'}
        />
      </View>
      <View style={styles.row}>
        <BigActionButton
          label="Wake"
          icon="white-balance-sunny"
          onPress={onPressWake}
          disabled={false}
          testID="btn-wake"
          accessibilityHint="Log a wake event or stop running sleep"
        />
        <BigActionButton
          label="Diaper"
          icon="emoticon-poop-outline"
          onPress={onPressDiaper}
          disabled={false}
          testID="btn-diaper"
          accessibilityHint="Log diaper change as wet; adjust on timeline if needed"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    width: '100%',
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  row: {
    flexDirection: 'row',
  },
});


