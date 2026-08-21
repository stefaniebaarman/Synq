import { sheetStyles } from "@/constants/sheetStyles";
import {
  ACCENT,
  BORDER,
  MUTED2,
  MUTED3,
  RADIUS_MD,
  SURFACE_INPUT,
  TYPE_CAPTION,
  fonts,
  formInputText,
  sheetTitleText,
  synqOutlineAddBtn,
  synqOutlineAddBtnDisabled,
  synqOutlineAddBtnText,
  synqOutlineAddBtnTextDisabled,
} from "@/constants/Variables";
import SpringBottomSheet from "@/src/components/sheets/SpringBottomSheet";
import {
  MAX_POLL_OPTION_LENGTH,
  MAX_POLL_OPTIONS,
  MAX_POLL_QUESTION_LENGTH,
  MIN_POLL_OPTIONS,
  validatePollDraft,
} from "@/src/lib/chatPoll";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  Keyboard,
  KeyboardEvent,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  visible: boolean;
  onClose: () => void;
  onSend: (question: string, options: string[]) => boolean | void | Promise<boolean | void>;
};

export default function CreatePollSheet({ visible, onClose, onSend }: Props) {
  const insets = useSafeAreaInsets();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [keyboardInset, setKeyboardInset] = useState(0);

  useEffect(() => {
    if (!visible) {
      setKeyboardInset(0);
      return;
    }
    setQuestion("");
    setOptions(["", ""]);
    setBusy(false);
    setError("");

    const onShow = (e: KeyboardEvent) => setKeyboardInset(e.endCoordinates.height);
    const onHide = () => setKeyboardInset(0);
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvt, onShow);
    const hideSub = Keyboard.addListener(hideEvt, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  const canAddOption = options.length < MAX_POLL_OPTIONS;
  const canRemoveOption = options.length > MIN_POLL_OPTIONS;
  const draft = validatePollDraft(question, options);
  const canSend = draft.ok && !busy;

  const setOptionAt = (index: number, value: string) => {
    setOptions((prev) => prev.map((option, i) => (i === index ? value : option)));
    if (error) setError("");
  };

  const addOption = () => {
    if (!canAddOption) return;
    setOptions((prev) => [...prev, ""]);
  };

  const removeOption = (index: number) => {
    if (!canRemoveOption) return;
    setOptions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    const next = validatePollDraft(question, options);
    if (!next.ok) {
      setError(next.reason);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await onSend(next.question, next.options);
      if (result === false) {
        setBusy(false);
        return;
      }
    } catch {
      setError("Could not send poll. Please try again.");
      setBusy(false);
    }
  };

  return (
    <SpringBottomSheet
      visible={visible}
      onClose={onClose}
      presentation="embedded"
      contentStyle={[
        styles.sheetGroup,
        {
          paddingBottom:
            Math.max(insets.bottom, 20) +
            20 +
            (keyboardInset > 0 ? Math.min(keyboardInset, 280) : 0),
        },
      ]}
      header={
        <Text style={sheetStyles.sheetKicker} numberOfLines={1}>
          Poll
        </Text>
      }
      cardStyle={sheetStyles.sheetCard}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={styles.bodyScroll}
        contentContainerStyle={styles.body}
      >
        <Text style={styles.title}>Create a poll</Text>
        <TextInput
          style={styles.questionInput}
          value={question}
          onChangeText={(value) => {
            setQuestion(value);
            if (error) setError("");
          }}
          placeholder="Question (optional)"
          placeholderTextColor={MUTED3}
          maxLength={MAX_POLL_QUESTION_LENGTH}
          autoFocus={visible}
          returnKeyType="next"
        />

        {options.map((option, index) => (
          <View key={`poll-option-${index}`} style={styles.optionRow}>
            <TextInput
              style={styles.optionInput}
              value={option}
              onChangeText={(value) => setOptionAt(index, value)}
              placeholder={`Option ${index + 1}`}
              placeholderTextColor={MUTED3}
              maxLength={MAX_POLL_OPTION_LENGTH}
              returnKeyType={index === options.length - 1 && canAddOption ? "next" : "done"}
            />
            {canRemoveOption ? (
              <TouchableOpacity
                onPress={() => removeOption(index)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={`Remove option ${index + 1}`}
              >
                <Ionicons name="close-circle" size={20} color={MUTED2} />
              </TouchableOpacity>
            ) : null}
          </View>
        ))}

        {canAddOption ? (
          <TouchableOpacity
            style={styles.addOptionBtn}
            onPress={addOption}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Add option"
          >
            <Ionicons name="add" size={18} color={ACCENT} />
            <Text style={styles.addOptionText}>Add option</Text>
          </TouchableOpacity>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[synqOutlineAddBtn, styles.sendBtn, !canSend && synqOutlineAddBtnDisabled]}
          disabled={!canSend}
          onPress={() => void handleSend()}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Send poll"
          accessibilityState={{ disabled: !canSend }}
        >
          <Text style={[synqOutlineAddBtnText, !canSend && synqOutlineAddBtnTextDisabled]}>
            {busy ? "Sending…" : "Send poll"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SpringBottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetGroup: {
    paddingHorizontal: 12,
  },
  bodyScroll: {
    maxHeight: 520,
  },
  body: {
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 28,
    gap: 10,
  },
  title: {
    ...sheetTitleText,
    marginBottom: 4,
  },
  questionInput: {
    ...formInputText,
    backgroundColor: SURFACE_INPUT,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: RADIUS_MD,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  optionInput: {
    flex: 1,
    ...formInputText,
    backgroundColor: SURFACE_INPUT,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: RADIUS_MD,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  addOptionBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    paddingVertical: 4,
  },
  addOptionText: {
    color: ACCENT,
    fontSize: TYPE_CAPTION,
    fontFamily: fonts.medium,
  },
  errorText: {
    color: MUTED2,
    fontSize: TYPE_CAPTION,
    fontFamily: fonts.book,
  },
  sendBtn: {
    marginTop: 8,
    marginBottom: 8,
    alignSelf: "center",
    minWidth: 148,
  },
});
