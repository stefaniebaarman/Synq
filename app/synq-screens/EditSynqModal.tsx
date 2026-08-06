import { DIALOG_ANIMATION } from "@/constants/sheetStyles";
import {
  MUTED2,
  MUTED3,
  TYPE_BUTTON,
  TYPE_MICRO,
  fonts,
  synqOutlineAddBtn,
  synqOutlineAddBtnDisabled,
  synqOutlineAddBtnText,
  synqOutlineAddBtnTextDisabled,
} from "@/constants/Variables";
import { useEffect, useState } from "react";
import {
  Keyboard,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

const MEMO_MAX = 60;

type Props = {
  visible: boolean;
  onClose: () => void;
  memo: string;
  setMemo: (t: string) => void;
  onSaveMemo: () => void | Promise<void>;
  saving?: boolean;
  styles: any;
};

export default function EditSynqModal({
  visible,
  onClose,
  memo,
  setMemo,
  onSaveMemo,
  saving = false,
  styles,
}: Props) {
  const [draft, setDraft] = useState(memo);

  useEffect(() => {
    if (!visible) return;
    setDraft(memo);
  }, [visible, memo]);

  return (
    <Modal visible={visible} transparent animationType={DIALOG_ANIMATION}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={[styles.centeredModalOverlay, localStyles.overlay]}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.editPanel}>
              <Text style={localStyles.eyebrow}>YOUR STATUS</Text>

              <TextInput
                style={[styles.panelInput, localStyles.input]}
                value={draft}
                onChangeText={(t) => {
                  const next = t.slice(0, MEMO_MAX);
                  setDraft(next);
                  setMemo(next);
                }}
                placeholder="e.g. down for a walk or matcha"
                placeholderTextColor={MUTED3}
                multiline
                maxLength={MEMO_MAX}
                submitBehavior="blurAndSubmit"
                returnKeyType="done"
                autoFocus
              />

              <TouchableOpacity
                style={[
                  synqOutlineAddBtn,
                  localStyles.saveBtn,
                  saving && synqOutlineAddBtnDisabled,
                ]}
                onPress={onSaveMemo}
                disabled={saving}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Save changes"
              >
                <Text
                  style={[
                    synqOutlineAddBtnText,
                    saving && synqOutlineAddBtnTextDisabled,
                  ]}
                >
                  Save changes
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onClose}
                style={localStyles.cancelBtn}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={localStyles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const localStyles = StyleSheet.create({
  overlay: {
    paddingBottom: 120,
  },
  eyebrow: {
    color: MUTED2,
    fontSize: TYPE_MICRO,
    fontFamily: fonts.medium,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  input: {
    minHeight: 48,
    maxHeight: 72,
    paddingVertical: 14,
    textAlignVertical: "center",
  },
  saveBtn: {
    marginTop: 8,
  },
  cancelBtn: {
    marginTop: 14,
    alignItems: "center",
    paddingVertical: 6,
  },
  cancelText: {
    color: MUTED2,
    fontFamily: fonts.medium,
    fontSize: TYPE_BUTTON,
  },
});
