import React, { ComponentProps } from 'react';
import { Pressable, Text, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

type Props = {
  label: string;
  sublabel?: string;
  icon?: IconName;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
  accessibilityHint?: string;
};

export function BigActionButton({
  label,
  sublabel,
  icon,
  onPress,
  disabled,
  testID,
  accessibilityHint,
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      hitSlop={12}
      style={({ pressed }) => [
        styles.button,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.content}>
        {icon ? <MaterialCommunityIcons name={icon} size={32} /> : null}
        <Text style={styles.label}>{label}</Text>
        {sublabel ? <Text style={styles.sublabel}>{sublabel}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flex: 1,
    minHeight: 96,
    margin: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.5 },
  content: { alignItems: 'center', gap: 6 },
  label: { fontSize: 20, fontWeight: '700' },
  sublabel: { fontSize: 12, opacity: 0.7 },
});


