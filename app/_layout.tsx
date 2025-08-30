import { Stack } from "expo-router";

/**
 * Root layout for Expo Router navigation stack.
 * Keeps headers hidden globally.
 */
export default function RootLayout() {
  return <Stack screenOptions={SCREEN_OPTIONS} />;
}

const SCREEN_OPTIONS = { headerShown: false } as const;
