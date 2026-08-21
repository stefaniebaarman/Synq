import {
  BG,
  BORDER_SOFT,
  BUTTON_RADIUS,
  formInputText,
  modalBodyText,
  MUTED2,
  sheetTitleText,
  MUTED3,
  OVERLAY_DARK,
  RADIUS_MD,
  SURFACE_SUBTLE,
  synqOutlineAddBtn,
  synqOutlineAddBtnDisabled,
  synqOutlineAddBtnText,
  synqOutlineAddBtnTextDisabled,
  TYPE_LEAD,
} from "@/constants/Variables";
import CloseButton from "@/src/components/CloseButton";
import { useEffect, useState } from "react";
import {
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
  hint = "Name a list to organize friends, like Running buddies or Gym crew.",
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

  const handleClose = () => {
    Keyboard.dismiss();
    onClose();
  };

  const compact = !hint;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleClose}
          accessibilityLabel="Dismiss"
        />
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
              <CloseButton onPress={handleClose} />
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
                style={[synqOutlineAddBtn, !canSubmit && synqOutlineAddBtnDisabled]}
                disabled={!canSubmit}
                onPress={() => void handleCreate()}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={submitLabel}
              >
                <Text
                  style={[
                    synqOutlineAddBtnText,
                    !canSubmit && synqOutlineAddBtnTextDisabled,
                  ]}
                >
                  {submitLabel}
                </Text>
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
    backgroundColor: OVERLAY_DARK,
  },
  sheetAnchor: {
    width: "100%",
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  sheet: {
    flexDirection: "column",
    backgroundColor: BG,
    borderRadius: RADIUS_MD,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER_SOFT,
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
    ...sheetTitleText,
  },
  hint: {
    ...modalBodyText,
    marginBottom: 20,
    lineHeight: 22,
  },
  input: {
    ...formInputText,
    borderRadius: BUTTON_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: MUTED3,
    backgroundColor: SURFACE_SUBTLE,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 52,
    marginBottom: 28,
  },
  inputCompact: {
    fontSize: TYPE_LEAD,
    minHeight: 44,
    paddingVertical: 10,
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
});
