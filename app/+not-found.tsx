import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import {
  ACCENT,
  BG,
  MUTED,
  ON_ACCENT_TEXT,
  modalBodyText,
  primaryButtonText,
  profileNameText,
} from "../constants/Variables";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Not found", headerShown: false }} />
      <View style={styles.container}>
        <Text style={styles.title}>This screen doesn’t exist.</Text>
        <Text style={styles.subtitle}>The link may be outdated or mistyped.</Text>

        <Link href="/" style={styles.link} accessibilityRole="link" accessibilityLabel="Go to home">
          <Text style={styles.linkText}>Go to home</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: BG,
  },
  title: {
    ...profileNameText,
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    ...modalBodyText,
    color: MUTED,
    textAlign: "center",
    marginBottom: 28,
  },
  link: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    backgroundColor: ACCENT,
  },
  linkText: primaryButtonText,
});
