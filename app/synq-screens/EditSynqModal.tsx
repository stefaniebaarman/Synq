import {
  MUTED,
  MUTED3,
} from "@/constants/Variables";
import CloseButton from "@/src/components/CloseButton";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
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
  onSaveMemo: () => void;
  styles: any;
};

const SUGGESTIONS = [
  "Down for drinks",
  "Anyone for happy hour?",
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
    <Modal visible={visible} transparent animationType="fade">
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
                style={styles.saveBtn}
                onPress={onSaveMemo}
                activeOpacity={0.85}
              >
                <Text style={styles.saveBtnText}>Update</Text>
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
});
