import StackScreenHeader from "@/src/components/StackScreenHeader";
import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { formScreenStyles } from "../../constants/formScreenStyles";
import {
  ACCENT,
  BG,
  BORDER,
  GROUP_BORDER,
  MUTED,
  MUTED3,
  ON_ACCENT_TEXT,
  RADIUS_LG,
  SPACE_2,
  SPACE_3,
  SPACE_4,
  SPACE_5,
  SPACE_6,
  SURFACE,
  SURFACE_RAISED,
  TEXT,
  TYPE_BODY,
  TYPE_BUTTON,
  TYPE_LEAD,
  fonts,
  heroTitleText,
  synqOutlineAddBtn,
  synqOutlineAddBtnDisabled,
  synqOutlineAddBtnText,
  synqOutlineAddBtnTextDisabled,
} from "../../constants/Variables";
import {
  submitFeedback,
  type FeedbackType,
} from "../../src/lib/feedback";
import { auth } from "../../src/lib/firebase";

import AlertModal from "../alert-modal";

export default function FeedbackScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<React.ComponentRef<typeof KeyboardAwareScrollView>>(null);
  const messageYRef = useRef(0);
  const [type, setType] = useState<FeedbackType>("Feedback");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title?: string;
    message: string;
    goBack?: boolean;
  } | null>(null);

  const canSubmit = message.trim().length >= 10 && !submitting;

  const keepMessageVisible = () => {
    const delay = Platform.OS === "ios" ? 100 : 0;
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, messageYRef.current - 72),
        animated: true,
      });
    }, delay);
  };

  const showAlert = (
    title: string,
    message: string,
    opts?: { goBack?: boolean }
  ) => {
    setAlertConfig({ title, message, goBack: opts?.goBack });
    setAlertVisible(true);
  };

  const submit = async () => {
    if (!auth.currentUser) {
      showAlert("Sign in required", "Sign in to send feedback.");
      return;
    }
    if (message.trim().length < 10) {
      showAlert("Add a bit more", "Please include at least 10 characters of feedback.");
      return;
    }

    setSubmitting(true);
    try {
      await submitFeedback({
        type,
        message: message.trim(),
        platform: Platform.OS,
      });
      setMessage("");
      setType("Feedback");
      showAlert("Thanks!", "Your feedback was sent.", { goBack: true });
    } catch {
      showAlert("Something went wrong", "We couldn't send your feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const TypeChip = ({ label }: { label: FeedbackType }) => {
    const active = type === label;
    return (
      <TouchableOpacity
        onPress={() => setType(label)}
        activeOpacity={0.85}
        style={[styles.chip, active && styles.chipActive]}
      >
        <Text style={[styles.chipText, active && styles.chipTextActive]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <StatusBar barStyle="light-content" />

      <StackScreenHeader title="Send feedback" />

      <KeyboardAwareScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        bottomOffset={16}
        extraKeyboardSpace={insets.bottom + 8}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Help us build Synq</Text>
          <Text style={styles.heroSubtitle}>
            Share feedback, report a bug, or suggest a feature.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={formScreenStyles.groupTitle}>Type</Text>
          <View style={styles.chipRow}>
            <TypeChip label="Feedback" />
            <TypeChip label="Bug" />
            <TypeChip label="Feature request" />
            <TypeChip label="Other" />
          </View>
        </View>

        <View
          style={styles.section}
          onLayout={(e) => {
            messageYRef.current = e.nativeEvent.layout.y;
          }}
        >
          <Text style={formScreenStyles.groupTitle}>Message</Text>
          <View style={styles.card}>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Tell us what you think…"
              placeholderTextColor={MUTED3}
              multiline
              textAlignVertical="top"
              style={[styles.input, styles.textarea]}
              onFocus={keepMessageVisible}
            />
          </View>
        </View>

        <TouchableOpacity
          onPress={() => void submit()}
          activeOpacity={0.8}
          disabled={!canSubmit}
          style={[
            synqOutlineAddBtn,
            styles.submitBtn,
            !canSubmit && synqOutlineAddBtnDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Submit feedback"
        >
          <Text
            style={[
              synqOutlineAddBtnText,
              !canSubmit && synqOutlineAddBtnTextDisabled,
            ]}
          >
            {submitting ? "Sending…" : "Submit"}
          </Text>
        </TouchableOpacity>

        <View style={styles.footerSpace} />
      </KeyboardAwareScrollView>

      <AlertModal
        visible={alertVisible}
        title={alertConfig?.title}
        message={alertConfig?.message || ""}
        onClose={() => {
          const shouldGoBack = alertConfig?.goBack;
          setAlertVisible(false);
          if (shouldGoBack) router.back();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  flex: { flex: 1 },

  scrollContent: {
    paddingBottom: SPACE_6 + SPACE_3,
    paddingTop: SPACE_3,
  },

  hero: {
    marginHorizontal: SPACE_4 + SPACE_3,
    marginBottom: SPACE_3,
    backgroundColor: SURFACE_RAISED,
    borderRadius: RADIUS_LG,
    padding: SPACE_4 + 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GROUP_BORDER,
  },
  heroTitle: {
    ...heroTitleText,
    marginBottom: SPACE_3 - 4,
  },
  heroSubtitle: {
    fontSize: TYPE_BUTTON,
    fontFamily: fonts.medium,
    color: MUTED,
    lineHeight: 22,
  },

  section: { marginTop: 2 },

  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACE_3 - 2,
    marginHorizontal: SPACE_4 + SPACE_3,
  },
  chip: {
    borderRadius: 999,
    paddingVertical: SPACE_3 - 3,
    paddingHorizontal: SPACE_3,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
  },
  chipActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  chipText: {
    color: TEXT,
    fontFamily: fonts.medium,
    fontSize: TYPE_LEAD,
  },
  chipTextActive: {
    color: ON_ACCENT_TEXT,
    fontFamily: fonts.heavy,
  },

  card: {
    backgroundColor: SURFACE_RAISED,
    marginHorizontal: SPACE_4 + SPACE_3,
    borderRadius: RADIUS_LG,
    padding: SPACE_4 + 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GROUP_BORDER,
  },

  input: {
    color: TEXT,
    fontFamily: fonts.medium,
    fontSize: TYPE_BODY,
    paddingVertical: SPACE_2,
  },
  textarea: {
    minHeight: 140,
  },

  submitBtn: {
    alignSelf: "center",
    marginTop: SPACE_4 + 2,
  },

  footerSpace: { height: SPACE_5 },
});
