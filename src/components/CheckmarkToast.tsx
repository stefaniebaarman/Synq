import {
  ACCENT,
  BG,
  BORDER,
  OVERLAY_MID,
  RADIUS_MD,
  SPACE_6,
  TEXT,
  TYPE_BODY,
  fonts,
} from "@/constants/Variables";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect } from "react";
import { Modal, StyleSheet, Text, View } from "react-native";

type Props = {
  visible: boolean;
  message: string;
  onDismiss: () => void;
  durationMs?: number;
};

export default function CheckmarkToast({
  visible,
  message,
  onDismiss,
  durationMs = 1400,
}: Props) {
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [visible, message, durationMs, onDismiss]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss}>
      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.card}>
          <Ionicons name="checkmark-circle" size={40} color={ACCENT} />
          <Text style={styles.message}>{message}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: OVERLAY_MID,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACE_6,
  },
  card: {
    backgroundColor: BG,
    borderRadius: RADIUS_MD,
    padding: SPACE_6,
    alignItems: "center",
    gap: 12,
    minWidth: 200,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
  },
  message: {
    fontFamily: fonts.heavy,
    fontSize: TYPE_BODY,
    color: TEXT,
    letterSpacing: 0.04,
  },
});
