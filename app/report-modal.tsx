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
  ON_ACCENT_TEXT,
  TEXT,
  TYPE_BODY,
  TYPE_BUTTON,
  TYPE_CAPTION,
  fonts,
} from "@/constants/Variables";
import { ReportReason, submitReport, type ReportContentType } from "@/src/lib/moderation";
import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity
} from "react-native";

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
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!reason || submitting) return;
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

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={sheetStyles.overlay} onPress={onClose}>
        <Pressable style={sheetStyles.sheetAlt} onPress={(e) => e.stopPropagation()}>
          <Text style={sheetStyles.title}>Report</Text>
          <Text style={sheetStyles.bodyCompact}>Why are you reporting this?</Text>

          {REASONS.map((r) => (
            <TouchableOpacity
              key={r.id}
              style={[styles.reasonRow, reason === r.id && styles.reasonRowActive]}
              onPress={() => setReason(r.id)}
            >
              <Text style={styles.reasonText}>{r.label}</Text>
            </TouchableOpacity>
          ))}

          <TextInput
            style={styles.input}
            placeholder="Additional details (optional)"
            placeholderTextColor={MUTED3}
            value={details}
            onChangeText={setDetails}
            multiline
            maxLength={500}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.submitBtn, (!reason || submitting) && styles.submitDisabled]}
            disabled={!reason || submitting}
            onPress={handleSubmit}
          >
            {submitting ? (
              <ActivityIndicator color={ON_ACCENT_TEXT} />
            ) : (
              <Text style={styles.submitText}>Submit report</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  reasonRow: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
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
    borderRadius: 12,
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
    height: 48,
    borderRadius: BUTTON_RADIUS,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  submitDisabled: { opacity: 0.45 },
  submitText: {
    color: ON_ACCENT_TEXT,
    fontFamily: fonts.heavy,
    fontSize: TYPE_BODY,
  },
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
