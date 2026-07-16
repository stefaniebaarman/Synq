import { DIALOG_ANIMATION } from "@/constants/sheetStyles";
import {
  MUTED,
  MUTED3,
  synqOutlineAddBtn,
  synqOutlineAddBtnDisabled,
  synqOutlineAddBtnText,
  synqOutlineAddBtnTextDisabled,
} from "@/constants/Variables";
import CloseButton from "@/src/components/CloseButton";
import { Ionicons } from "@expo/vector-icons";
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

type Props = {
  visible: boolean;
  onClose: () => void;
  memo: string;
  setMemo: (t: string) => void;
  onSaveMemo: () => void | Promise<void>;
  saving?: boolean;
  styles: any;
};

const SUGGESTIONS = [
  "Down for drinks",
  "Happy hour?",
  "Coffee?",
  "Down for something chill",
  "Quick bite?",
  "Down for a walk",
  "Gym?",
  "Going for a run",
  "Movie night?",
  "Game night?",
  "Down for something fun",
  "What's the move?",
];

export default function EditSynqModal({
  visible,
  onClose,
  memo,
  setMemo,
  onSaveMemo,
  saving = false,
  styles,
}: Props) {
  const [visibleSuggestions, setVisibleSuggestions] = useState<string[]>([]);

  const pickSuggestions = () => {
    const exclude = memo.trim().toLowerCase();
    const shuffled = [...SUGGESTIONS]
      .sort(() => 0.5 - Math.random())
      .filter((s) => s.toLowerCase() !== exclude);
    setVisibleSuggestions(shuffled.slice(0, 4));
  };

  useEffect(() => {
    if (!visible) return;
    pickSuggestions();
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType={DIALOG_ANIMATION}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.centeredModalOverlay}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.editPanel}>
              <View style={localStyles.headerRow}>
                <Text style={styles.panelTitle}>Edit status</Text>
                <CloseButton onPress={onClose} style={localStyles.headerClose} />
              </View>

              <TextInput
                style={styles.panelInput}
                value={memo}
                onChangeText={setMemo}
                placeholder="e.g. let's grab drinks"
                placeholderTextColor={MUTED3}
                multiline
                submitBehavior="blurAndSubmit"
                returnKeyType="done"
              />

              <View style={localStyles.suggestionHeaderRow}>
                <Text style={styles.suggestionSectionTitle}>Suggested ideas</Text>
                <TouchableOpacity
                  onPress={pickSuggestions}
                  style={localStyles.shuffleBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="Shuffle suggested ideas"
                >
                  <Ionicons
                    name="shuffle-outline"
                    size={24}
                    color={MUTED}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.suggestionWrap}>
                {visibleSuggestions.map((s, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.suggestionChip}
                    onPress={() => setMemo(s)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.suggestionText}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>

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
                accessibilityLabel="Update status"
              >
                <Text
                  style={[
                    synqOutlineAddBtnText,
                    saving && synqOutlineAddBtnTextDisabled,
                  ]}
                >
                  Update
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const localStyles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
    minHeight: 44,
  },
  headerClose: {
    marginRight: -10,
    marginTop: -2,
  },
  suggestionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    minHeight: 40,
  },
  shuffleBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginRight: -6,
  },
  saveBtn: {
    marginTop: 20,
  },
});
