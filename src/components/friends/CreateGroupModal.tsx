import {
  ACCENT,
  BG,
  BUTTON_RADIUS,
  MUTED2,
  ON_ACCENT_TEXT,
  TEXT,
  TYPE_BODY,
  TYPE_CTA,
  fonts,
} from "@/constants/Variables";
import CloseButton from "@/src/components/CloseButton";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  visible: boolean;
  busy?: boolean;
  onClose: () => void;
  onCreate: (name: string) => void | Promise<void>;
  title?: string;
  hint?: string;
  submitLabel?: string;
  placeholder?: string;
  initialName?: string;
};

const WINDOW_HEIGHT = Dimensions.get("window").height;

export default function CreateGroupModal({
  visible,
  busy,
  onClose,
  onCreate,
  title = "New group",
  hint = "Name a list to organize friends — like Close friends or Gym crew.",
  submitLabel = "Create group",
  placeholder = "Group name",
  initialName = "",
}: Props) {
  const [name, setName] = useState("");
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!visible) {
      setName("");
      return;
    }
    setName(initialName);
  }, [visible, initialName]);

  const trimmed = name.trim();
  const isDirty = trimmed !== initialName.trim();
  const canSubmit = trimmed.length > 0 && isDirty && !busy;

  const handleCreate = async () => {
    if (!canSubmit) return;
    Keyboard.dismiss();
    await onCreate(trimmed);
  };

  const compact = !hint;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Dismiss" />
        <KeyboardAvoidingView
          style={[
            styles.sheetAnchor,
            { paddingTop: Math.max(insets.top + 72, WINDOW_HEIGHT * 0.24) },
          ]}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 8 : 0}
        >
          <Pressable
            style={[styles.sheet, !compact && styles.sheetTall]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <CloseButton onPress={onClose} />
            </View>
            {hint ? <Text style={styles.hint}>{hint}</Text> : null}
            <TextInput
              style={[styles.input, compact && styles.inputCompact]}
              placeholder={placeholder}
              placeholderTextColor={MUTED2}
              value={name}
              onChangeText={setName}
              maxLength={40}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => void handleCreate()}
            />
            <View style={[styles.ctaRow, compact && styles.ctaRowCompact]}>
              <TouchableOpacity
                style={[styles.cta, !canSubmit && styles.ctaDisabled]}
                disabled={!canSubmit}
                onPress={() => void handleCreate()}
                accessibilityRole="button"
                accessibilityLabel={submitLabel}
              >
                {busy ? (
                  <ActivityIndicator color={ON_ACCENT_TEXT} />
                ) : (
                  <Text style={styles.ctaText}>{submitLabel}</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
  },
  sheetAnchor: {
    width: "100%",
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  sheet: {
    flexDirection: "column",
    backgroundColor: BG,
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
  },
  sheetTall: {
    minHeight: 300,
    paddingBottom: 28,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: {
    fontFamily: fonts.medium,
    fontSize: TYPE_CTA,
    color: TEXT,
  },
  hint: {
    fontFamily: fonts.book,
    fontSize: TYPE_BODY,
    color: MUTED2,
    marginBottom: 20,
    lineHeight: 22,
  },
  input: {
    borderRadius: BUTTON_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
    color: TEXT,
    fontFamily: fonts.book,
    fontSize: TYPE_BODY,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 52,
    marginBottom: 28,
  },
  inputCompact: {
    marginBottom: 16,
  },
  ctaRow: {
    alignItems: "center",
    marginTop: "auto",
    paddingTop: 8,
  },
  ctaRowCompact: {
    marginTop: 0,
    paddingTop: 0,
  },
  cta: {
    minHeight: 48,
    paddingHorizontal: 32,
    borderRadius: BUTTON_RADIUS,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  ctaDisabled: {
    opacity: 0.45,
  },
  ctaText: {
    fontFamily: fonts.medium,
    fontSize: TYPE_BODY,
    color: ON_ACCENT_TEXT,
  },
});
