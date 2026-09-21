import {
  ACCENT,
  ACCENT_BORDER,
  TEXT,
  TYPE_BODY,
  TYPE_BUTTON,
  fonts,
} from "@/constants/Variables";
import type { DropInPlace } from "@/src/lib/dropIn";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  text: string;
  place: DropInPlace | null;
  expiresAtMs?: number | null;
  notifiedCount?: number;
  onCancel: () => void;
  cancelBusy?: boolean;
};

export default function DropInLiveBanner({
  text,
  place,
  onCancel,
  cancelBusy,
}: Props) {
  const placeLabel = place?.name?.trim() || text;

  return (
    <View style={styles.banner} accessibilityRole="summary">
      <View style={styles.pinWrap}>
        <Ionicons name="location" size={22} color={ACCENT} />
      </View>
      <View style={styles.main}>
        <Text style={styles.title}>You're at {placeLabel}</Text>
      </View>
      <Pressable
        onPress={onCancel}
        disabled={cancelBusy}
        style={({ pressed }) => [
          styles.endBtn,
          pressed && styles.endBtnPressed,
          cancelBusy && styles.endBtnBusy,
        ]}
        accessibilityRole="button"
        accessibilityLabel="End live status"
      >
        <Text style={styles.endText}>End</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingLeft: 14,
    paddingRight: 12,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: "#0B1A12",
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
  },
  pinWrap: {
    width: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: fonts.medium,
    fontSize: TYPE_BODY,
    color: TEXT,
    lineHeight: 20,
  },
  endBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
    backgroundColor: "rgba(0,0,0,0.25)",
    alignSelf: "center",
  },
  endBtnPressed: {
    opacity: 0.85,
  },
  endBtnBusy: {
    opacity: 0.5,
  },
  endText: {
    fontFamily: fonts.medium,
    fontSize: TYPE_BUTTON,
    color: TEXT,
  },
});
