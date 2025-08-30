import { View, Text, StyleSheet } from "react-native";

/**
 * Index screen for Expo Router.
 * Renders the initial greeting. No business logic here.
 */
export default function IndexScreen() {
  return (
    <View style={styles.container}>
      <Text accessibilityRole="text">Hello Baby App 👶</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
