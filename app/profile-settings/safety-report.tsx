import StackScreenHeader from "@/src/components/StackScreenHeader";
import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import {
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  ACCENT,
  BG,
  BORDER,
  MUTED,
  MUTED3,
  ON_ACCENT_TEXT,
  RADIUS_MD,
  SPACE_4,
  SURFACE,
  TEXT,
  TYPE_BODY,
  TYPE_BUTTON,
  TYPE_CAPTION,
  fonts,
} from "../../constants/Variables";
import { auth } from "../../src/lib/firebase";
import { submitReport, type ReportReason } from "../../src/lib/moderation";
import AlertModal from "../alert-modal";

/** Firestore queue when the report is not tied to a specific profile. */
const GENERAL_SAFETY_REPORT_USER_ID = "_general_safety";

const REASONS: { id: ReportReason; label: string }[] = [
  { id: "harassment", label: "Harassment or bullying" },
  { id: "hate", label: "Hate or discrimination" },
  { id: "sexual", label: "Sexual or explicit content" },
  { id: "spam", label: "Spam or scam" },
  { id: "other", label: "Other safety concern" },
];

export default function SafetyReportScreen() {
  const params = useLocalSearchParams<{ reportedUserId?: string | string[] }>();
  const reportedUserIdParam =
    typeof params.reportedUserId === "string"
      ? params.reportedUserId
      : Array.isArray(params.reportedUserId)
        ? params.reportedUserId[0]
        : "";
  const [reportedUserId] = useState(reportedUserIdParam);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const scrollRef = useRef<ScrollView>(null);
  const detailsScrollY = useRef(0);

  const nudgeDetailsAboveKeyboard = () => {
    const delay = Platform.OS === "ios" ? 100 : 0;
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, detailsScrollY.current - 140),
        animated: true,
      });
    }, delay);
  };

  const handleSubmit = async () => {
    if (!auth.currentUser) {
      setAlertMessage("Sign in to submit a safety report.");
      setAlertVisible(true);
      return;
    }
    if (!reason) {
      setAlertMessage("Select a reason for your report.");
      setAlertVisible(true);
      return;
    }
    setSubmitting(true);
    try {
      const result = await submitReport({
        reportedUserId: reportedUserId.trim() || GENERAL_SAFETY_REPORT_USER_ID,
        contentType: "user",
        reason,
        details: details.trim() || undefined,
      });
      if (result.duplicate) {
        setAlertMessage(
          "You already have an open report for this issue. Change the reason or details, or wait until it is reviewed."
        );
      } else if (result.emailSent === false) {
        setAlertMessage(
          "Report saved, but the alert email could not be sent. Check Firebase function logs (moderation_email_failed)."
        );
      } else {
        setAlertMessage("Report submitted. We aim to review within 24 hours.");
      }
      setAlertVisible(true);
      if (!result.duplicate) {
        setReason(null);
        setDetails("");
      }
    } catch {
      setAlertMessage("Could not submit report. Please try again.");
      setAlertVisible(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <StackScreenHeader title="Report a safety issue" />

      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
      >
        <Text style={styles.lead}>
          {reportedUserId.trim()
            ? "Tell us what happened. We review reports within 24 hours."
            : "Describe the safety issue below. We review reports within 24 hours."}
        </Text>

        {REASONS.map((r) => (
          <TouchableOpacity
            key={r.id}
            style={[styles.reasonRow, reason === r.id && styles.reasonActive]}
            onPress={() => setReason(r.id)}
          >
            <Text style={styles.reasonText}>{r.label}</Text>
          </TouchableOpacity>
        ))}

        <View
          onLayout={(e) => {
            detailsScrollY.current = e.nativeEvent.layout.y;
          }}
        >
          <TextInput
            style={[styles.input, styles.details]}
            placeholder="What happened? (optional)"
            placeholderTextColor={MUTED3}
            value={details}
            onChangeText={setDetails}
            multiline
            textAlignVertical="top"
            onFocus={nudgeDetailsAboveKeyboard}
          />
        </View>

        <TouchableOpacity
          style={[
            styles.submit,
            (submitting || !reason) && styles.submitDisabled,
          ]}
          disabled={submitting || !reason}
          onPress={handleSubmit}
        >
          <Text style={styles.submitText}>
            {submitting ? "Submitting…" : "Submit report"}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <AlertModal
        visible={alertVisible}
        message={alertMessage}
        onClose={() => {
          setAlertVisible(false);
          if (alertMessage.includes("submitted")) router.back();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  scrollView: { flex: 1 },
  scroll: { padding: SPACE_4, paddingBottom: 32 },
  lead: {
    color: MUTED,
    fontFamily: fonts.medium,
    fontSize: TYPE_BODY,
    lineHeight: 22,
    marginBottom: 20,
  },
  label: {
    color: MUTED,
    fontFamily: fonts.medium,
    fontSize: TYPE_CAPTION,
    marginBottom: 8,
  },
  input: {
    backgroundColor: SURFACE,
    borderRadius: RADIUS_MD,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    color: TEXT,
    fontFamily: fonts.medium,
    marginBottom: 16,
  },
  details: { minHeight: 100, textAlignVertical: "top" },
  reasonRow: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
  },
  reasonActive: { borderColor: ACCENT },
  reasonText: { color: TEXT, fontFamily: fonts.medium, fontSize: TYPE_BUTTON },
  submit: {
    marginTop: 8,
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitDisabled: { opacity: 0.45 },
  submitText: { color: ON_ACCENT_TEXT, fontFamily: fonts.heavy, fontSize: TYPE_BODY },
});
