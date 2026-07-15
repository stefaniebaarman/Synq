import { sheetStyles } from "@/constants/sheetStyles";
import {
  ACCENT,
  ACCENT_SELECTED_BG,
  BG,
  BORDER,
  BUTTON_RADIUS,
  DESTRUCTIVE,
  MUTED,
  MUTED3,
  TEXT,
  TYPE_BUTTON,
  TYPE_CAPTION,
  fonts,
  primaryButtonText,
  RADIUS_SM,
} from "@/constants/Variables";
import { ReportReason, submitReport, type ReportContentType } from "@/src/lib/moderation";
import { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardEvent,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const REASONS: { id: ReportReason; label: string }[] = [
  { id: "harassment", label: "Harassment or bullying" },
  { id: "hate", label: "Hate or discrimination" },
  { id: "sexual", label: "Sexual or explicit content" },
  { id: "spam", label: "Spam or scam" },
  { id: "other", label: "Other" },
];

type Props = {
  visible: boolean;
  reportedUserId: string;
  contentType: ReportContentType;
  chatId?: string;
  messageId?: string;
  contentId?: string;
  onClose: () => void;
  onSubmitted?: () => void;
};

export default function ReportModal({
  visible,
  reportedUserId,
  contentType,
  chatId,
  messageId,
  contentId,
  onClose,
  onSubmitted,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);

  useEffect(() => {
    if (!visible) {
      setKeyboardInset(0);
      return;
    }

    const onShow = (e: KeyboardEvent) => {
      setKeyboardInset(e.endCoordinates.height);
      // Keep the details field above the keyboard.
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, Platform.OS === "ios" ? 60 : 0);
    };
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

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  const handleClose = () => {
    Keyboard.dismiss();
    onClose();
  };

  const handleBackdropPress = () => {
    if (keyboardInset > 0) {
      Keyboard.dismiss();
      return;
    }
    handleClose();
  };

  const handleSubmit = async () => {
    if (!reason || submitting) return;
    Keyboard.dismiss();
    setSubmitting(true);
    setError(null);
    try {
      await submitReport({
        reportedUserId,
        contentType,
        reason,
        details: details.trim() || undefined,
        chatId,
        messageId,
        contentId,
      });
      setReason(null);
      setDetails("");
      onSubmitted?.();
      onClose();
    } catch {
      setError("Could not submit report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const keyboardOpen = keyboardInset > 0;
  // iOS modals don't resize for the keyboard; Android often does — don't double-lift.
  const sheetLift = Platform.OS === "ios" ? keyboardInset : 0;
  const paddingBottom = keyboardOpen ? 12 : Math.max(24, insets.bottom);
  const sheetHeight = Math.min(
    windowHeight * 0.92,
    Math.max(480, windowHeight - sheetLift - insets.top - 12)
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={sheetStyles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleBackdropPress}
          accessibilityLabel="Dismiss"
        />
        <Pressable
          style={[
            sheetStyles.sheetAlt,
            styles.sheet,
            {
              height: sheetHeight,
              paddingBottom,
              marginBottom: sheetLift,
            },
          ]}
          onPress={dismissKeyboard}
          accessible={false}
        >
          <Pressable onPress={dismissKeyboard} accessible={false}>
            <Text style={sheetStyles.title}>Report</Text>
          </Pressable>

          <ScrollView
            ref={scrollRef}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            onScrollBeginDrag={dismissKeyboard}
            showsVerticalScrollIndicator={false}
            bounces={false}
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
          >
            <Pressable style={styles.scrollBody} onPress={dismissKeyboard} accessible={false}>
              {REASONS.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.reasonRow, reason === r.id && styles.reasonRowActive]}
                  onPress={() => {
                    dismissKeyboard();
                    setReason(r.id);
                  }}
                >
                  <Text style={styles.reasonText}>{r.label}</Text>
                </TouchableOpacity>
              ))}

              <TextInput
                style={styles.input}
                placeholder="Why are you reporting this?"
                placeholderTextColor={MUTED3}
                value={details}
                onChangeText={setDetails}
                multiline
                maxLength={500}
                blurOnSubmit
                returnKeyType="done"
                onFocus={() => {
                  setTimeout(() => {
                    scrollRef.current?.scrollToEnd({ animated: true });
                  }, 100);
                }}
                onSubmitEditing={dismissKeyboard}
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.submitBtn, (!reason || submitting) && styles.submitDisabled]}
                disabled={!reason || submitting}
                onPress={handleSubmit}
              >
                <Text style={[primaryButtonText, submitting && { opacity: 0.5 }]}>
                  Submit report
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleClose} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </Pressable>
          </ScrollView>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    width: "100%",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 8,
  },
  scrollBody: {
    flexGrow: 1,
  },
  reasonRow: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: RADIUS_SM,
    marginBottom: 8,
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: BORDER,
  },
  reasonRowActive: {
    borderColor: ACCENT,
    backgroundColor: ACCENT_SELECTED_BG,
  },
  reasonText: {
    color: TEXT,
    fontFamily: fonts.medium,
    fontSize: TYPE_BUTTON,
  },
  input: {
    marginTop: 8,
    minHeight: 72,
    borderRadius: RADIUS_SM,
    padding: 12,
    backgroundColor: BG,
    color: TEXT,
    fontFamily: fonts.medium,
    fontSize: TYPE_BUTTON,
    textAlignVertical: "top",
  },
  error: {
    color: DESTRUCTIVE,
    fontFamily: fonts.medium,
    fontSize: TYPE_CAPTION,
    marginTop: 8,
  },
  submitBtn: {
    marginTop: 16,
    alignSelf: "center",
    width: "78%",
    height: 48,
    borderRadius: BUTTON_RADIUS,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  submitDisabled: { opacity: 0.45 },
  cancelBtn: {
    marginTop: 12,
    alignItems: "center",
    paddingVertical: 8,
  },
  cancelText: {
    color: MUTED,
    fontFamily: fonts.medium,
    fontSize: TYPE_BUTTON,
  },
});
