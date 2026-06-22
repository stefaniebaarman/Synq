import StackScreenHeader from "@/src/components/StackScreenHeader";
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Linking,
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
import { formScreenStyles } from "../../constants/formScreenStyles";
import {
  ACCENT,
  BG,
  BORDER,
  BUTTON_RADIUS,
  MUTED,
  MUTED3,
  ON_ACCENT_TEXT,
  RADIUS_MD,
  SPACE_2,
  SPACE_3,
  SPACE_4,
  SPACE_5,
  SPACE_6,
  SURFACE,
  TEXT,
  heroTitleText,
  TYPE_BODY,
  TYPE_BUTTON,
  TYPE_CAPTION,
  TYPE_LEAD,
  TYPE_SECTION,
  fonts,
} from "../../constants/Variables";

import AlertModal from "../alert-modal";

const FEEDBACK_EMAIL = "synqapp@gmail.com";

export default function FeedbackScreen() {
  const [type, setType] = useState<"Feedback" | "Bug" | "Feature Request">("Feedback");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title?: string;
    message: string;
  } | null>(null);

  const subject = useMemo(() => `Synq ${type}`, [type]);
  const canSubmit = message.trim().length >= 10;

  const showAlert = (title: string, message: string) => {
    setAlertConfig({ title, message });
    setAlertVisible(true);
  };

  const submit = async () => {
    if (!canSubmit) {
      showAlert("Add a bit more", "Please include at least 10 characters of feedback.");
      return;
    }

    const bodyLines = [
      `Type: ${type}`,
      email.trim() ? `Contact: ${email.trim()}` : `Contact: (not provided)`,
      "",
      "Message:",
      message.trim(),
      "",
      "—",
      `Platform: ${Platform.OS}`,
    ];

    const mailto = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(bodyLines.join("\n"))}`;

    try {
      const supported = await Linking.canOpenURL(mailto);

      if (!supported) {
        showAlert("Email not available", "No email app is configured on this device.");
        return;
      }

      await Linking.openURL(mailto);

      showAlert("Thanks!", "Your email app opened with your feedback ready to send.");

      setMessage("");
      setEmail("");
      setType("Feedback");
    } catch {
      showAlert("Something went wrong", "We couldn't open your email app.");
    }
  };

  const TypeChip = ({
    label,
  }: {
    label: "Feedback" | "Bug" | "Feature Request";
  }) => {
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
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <StackScreenHeader title="Feedback" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>Help us build Synq</Text>
            <Text style={styles.heroSubtitle}>
              Share feedback, report a bug, or suggest a feature. This will open your email app and
              send to <Text style={styles.bold}>synqapp@gmail.com</Text>.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={formScreenStyles.groupTitle}>Type</Text>
            <View style={styles.chipRow}>
              <TypeChip label="Feedback" />
              <TypeChip label="Bug" />
              <TypeChip label="Feature Request" />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={formScreenStyles.groupTitle}>Your email (optional)</Text>
            <View style={styles.card}>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={MUTED3}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />
            </View>
          </View>

          <View style={styles.section}>
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
              />
            </View>
          </View>

          <TouchableOpacity
            onPress={submit}
            activeOpacity={0.9}
            style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          >
            <Text style={styles.submitText}>Submit</Text>
            <Ionicons name="send" size={18} color="black" />
          </TouchableOpacity>

          <View style={styles.footerSpace} />
        </ScrollView>
      </KeyboardAvoidingView>

      <AlertModal
        visible={alertVisible}
        title={alertConfig?.title}
        message={alertConfig?.message || ""}
        onClose={() => setAlertVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  scrollContent: {
    paddingBottom: SPACE_6 + SPACE_3,
    paddingTop: SPACE_3,
  },

  hero: {
    marginHorizontal: SPACE_4 + SPACE_3,
    marginBottom: SPACE_3,
    backgroundColor: SURFACE,
    borderRadius: RADIUS_MD,
    padding: SPACE_4 + 2,
    borderWidth: 1,
    borderColor: BORDER,
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
  bold: { fontFamily: fonts.heavy, color: TEXT },

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
    backgroundColor: SURFACE,
    marginHorizontal: SPACE_4 + SPACE_3,
    borderRadius: RADIUS_MD,
    padding: SPACE_4 + 2,
    borderWidth: 1,
    borderColor: BORDER,
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
    marginTop: SPACE_4 + 2,
    marginHorizontal: SPACE_4 + SPACE_3,
    backgroundColor: ACCENT,
    borderRadius: BUTTON_RADIUS + 2,
    paddingVertical: SPACE_4 - 2,
    paddingHorizontal: SPACE_4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE_3 - 2,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitText: {
    color: ON_ACCENT_TEXT,
    fontFamily: fonts.black,
    fontSize: TYPE_BODY,
  },

  footerSpace: { height: SPACE_5 },
});
