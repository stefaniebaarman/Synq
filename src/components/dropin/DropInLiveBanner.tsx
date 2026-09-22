import {
  ACCENT,
  BORDER,
  MUTED2,
  SURFACE_INPUT,
  TEXT,
  TYPE_BODY,
  TYPE_CAPTION,
  fonts,
  synqOutlineAddBtnCompact,
  synqOutlineAddBtnDisabled,
  synqOutlineAddBtnTextCompact,
  synqOutlineAddBtnTextDisabled,
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
  const headline =
    place?.name?.trim() || text.trim() || "Nearby";

  return (
    <View
      style={styles.banner}
      accessibilityRole="summary"
      accessibilityLabel={`You're at ${headline}`}
    >
      <View style={styles.pinWrap}>
        <Ionicons name="location" size={20} color={ACCENT} />
      </View>
      <View style={styles.main}>
        <Text style={styles.eyebrow}>You're at</Text>
        <Text style={styles.place} numberOfLines={2}>
          {headline}
        </Text>
      </View>
      <Pressable
        onPress={onCancel}
        disabled={cancelBusy}
        style={[
          synqOutlineAddBtnCompact,
          cancelBusy && synqOutlineAddBtnDisabled,
        ]}
        accessibilityRole="button"
        accessibilityLabel="End live status"
      >
        <Text
          style={[
            synqOutlineAddBtnTextCompact,
            cancelBusy && synqOutlineAddBtnTextDisabled,
          ]}
        >
          End
        </Text>
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
    borderRadius: 16,
    backgroundColor: SURFACE_INPUT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
  },
  pinWrap: {
    width: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  main: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  eyebrow: {
    fontFamily: fonts.book,
    fontSize: TYPE_CAPTION,
    color: MUTED2,
    lineHeight: 16,
  },
  place: {
    fontFamily: fonts.heavy,
    fontSize: TYPE_BODY,
    color: TEXT,
    lineHeight: 21,
  },
});
