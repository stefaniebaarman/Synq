import {
  onboardingAuthInnerMarginTop,
  ONBOARDING_BACK_LEFT,
  ONBOARDING_BACK_TOP,
  ONBOARDING_DIVIDER_MARGIN_TOP,
  ONBOARDING_DIVIDER_WIDTH,
  ONBOARDING_H_PADDING,
  ONBOARDING_SCROLL_BOTTOM,
  ONBOARDING_SUBTITLE_MARGIN_TOP,
  ONBOARDING_SUBTITLE_SIZE,
  ONBOARDING_TITLE_LINE_HEIGHT,
  ONBOARDING_TITLE_SIZE,
} from "@/constants/onboardingLayout";
import {
  ACCENT,
  BG,
  BORDER,
  BUTTON_RADIUS,
  MUTED,
  ON_ACCENT_TEXT,
  PRIMARY_CTA_HEIGHT,
  PRIMARY_CTA_WIDTH,
  SURFACE,
  TEXT,
  TYPE_BODY,
  TYPE_CAPTION,
  TYPE_CTA,
  TYPE_LEAD,
  TYPE_MODAL_TITLE,
  fonts,
  synqSvg,
} from "@/constants/Variables";
import BackButton from "@/src/components/BackButton";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from "react-native";
import { SvgXml } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AlertModal from "../alert-modal";
import { auth } from "../../src/lib/firebase";

export default function Login() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);

  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState<string | undefined>();
  const [alertMessage, setAlertMessage] = useState("");

  const showAlert = (message: string, title?: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  };

  const handleLogin = async () => {
    if (!email || !password) {
      showAlert("Please enter both your email and password.");
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(
        auth,
        email.trim().toLowerCase(),
        password
      );
    } catch (error: any) {
      let errorMessage = "Incorrect email or password. Please try again.";
      if (error.code === "auth/too-many-requests") {
        errorMessage = "Too many failed attempts. Try resetting your password.";
      }
      showAlert(errorMessage, "Login Failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSendReset = async () => {
    if (!resetEmail) return;
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim().toLowerCase());
      setResetModalVisible(false);
      showAlert(
        "If an account exists for this email, a reset link has been sent.",
        "Check your inbox"
      );
    } catch (e) {
      showAlert("Could not send reset email.", "Error");
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.root}>
        <View pointerEvents="none" style={styles.bgSvgWrap}>
          <SvgXml xml={synqSvg} width="120%" height="120%" />
        </View>
        <BackButton onPress={() => router.back()} style={styles.backBtn} />

        <View style={styles.container}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[
              styles.scrollContent,
              {
                paddingTop: Math.max(
                  onboardingAuthInnerMarginTop(),
                  insets.top + 24
                ),
                paddingBottom: ONBOARDING_SCROLL_BOTTOM + insets.bottom,
              },
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            onScrollBeginDrag={Keyboard.dismiss}
            showsVerticalScrollIndicator={false}
            automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
          >
          <View style={styles.inner}>
            <Text style={styles.title}>Welcome back!</Text>
            <View style={styles.divider} />
            <Text style={styles.subtitle}>Sign in to your account</Text>

            <View style={styles.inputGroup}>
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="rgba(255,255,255,0.25)"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <View>
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />

                <TouchableOpacity
                  onPress={() => {
                    setResetEmail(email);
                    setResetModalVisible(true);
                  }}
                  style={styles.forgotBtn}
                  activeOpacity={0.7}
                >
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                (loading || !email || !password) && styles.disabledButton,
              ]}
              onPress={handleLogin}
              disabled={loading || !email || !password}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#061006" />
              ) : (
                <Text style={styles.primaryButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>
          </View>
          </ScrollView>
        </View>

        <Modal visible={resetModalVisible} transparent animationType="fade">
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={styles.modalOverlay}>
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={styles.modalScrollContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                onScrollBeginDrag={Keyboard.dismiss}
              >
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Reset password</Text>
                <Text style={styles.modalSubtitle}>
                  Enter your email and we’ll send you a link to get back into your account.
                </Text>

                <TextInput
                  style={styles.modalInput}
                  placeholder="Email address"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  value={resetEmail}
                  onChangeText={setResetEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />

                <TouchableOpacity
                  style={[styles.primaryButton, { marginTop: 14 }]}
                  onPress={handleSendReset}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryButtonText}>Send Link</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setResetModalVisible(false)}
                  style={styles.cancelBtn}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
        <AlertModal
          visible={alertVisible}
          title={alertTitle}
          message={alertMessage}
          onClose={() => setAlertVisible(false)}
        />
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  bgSvgWrap: {
    position: "absolute",
    top: -40,
    left: -40,
    right: -40,
    bottom: -40,
    opacity: 0.35,
    transform: [{ rotate: "-8deg" }],
  },
  backBtn: {
    position: "absolute",
    top: ONBOARDING_BACK_TOP,
    left: ONBOARDING_BACK_LEFT,
    zIndex: 10,
  },
  container: { flex: 1, paddingHorizontal: ONBOARDING_H_PADDING },
  scrollContent: { flexGrow: 1 },
  inner: { width: "100%" },
  title: {
    color: TEXT,
    fontSize: ONBOARDING_TITLE_SIZE,
    fontFamily: fonts.heavy,
    letterSpacing: 0.2,
    lineHeight: ONBOARDING_TITLE_LINE_HEIGHT,
  },
  divider: {
    marginTop: ONBOARDING_DIVIDER_MARGIN_TOP,
    height: 1,
    backgroundColor: BORDER,
    width: ONBOARDING_DIVIDER_WIDTH,
  },
  subtitle: {
    color: MUTED,
    fontSize: ONBOARDING_SUBTITLE_SIZE,
    marginTop: ONBOARDING_SUBTITLE_MARGIN_TOP,
    marginBottom: 26,
    fontFamily: fonts.book,
    lineHeight: 22,
  },
  inputGroup: { gap: 12 },
  input: {
    backgroundColor: SURFACE,
    height: 56,
    borderRadius: 14,
    paddingHorizontal: 16,
    color: TEXT,
    fontSize: TYPE_BODY,
    fontFamily: fonts.medium,
    borderWidth: 1,
    borderColor: BORDER,
  },
  forgotBtn: { alignSelf: "flex-end", marginTop: 10, paddingVertical: 4 },
  forgotText: {
    color: "rgba(255,255,255,0.45)",
    fontSize: TYPE_CAPTION,
    fontFamily: fonts.book,
  },
  primaryButton: {
    alignSelf: "center",
    width: PRIMARY_CTA_WIDTH,
    backgroundColor: ACCENT,
    height: PRIMARY_CTA_HEIGHT,
    borderRadius: BUTTON_RADIUS,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 18,
  },
  primaryButtonText: {
    color: ON_ACCENT_TEXT,
    fontSize: TYPE_CTA,
    fontFamily: fonts.heavy,
    letterSpacing: 0.2,
  },
  disabledButton: { backgroundColor: "rgba(125,255,166,0.30)" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.78)",
    justifyContent: "center",
    padding: ONBOARDING_H_PADDING,
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: 8,
  },
  modalContent: {
    backgroundColor: "rgba(18,18,18,0.96)",
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: BORDER,
  },
  modalTitle: {
    color: TEXT,
    fontSize: TYPE_MODAL_TITLE,
    fontFamily: fonts.heavy,
    letterSpacing: 0.2,
    marginBottom: 8,
  },
  modalSubtitle: {
    color: MUTED,
    fontSize: TYPE_LEAD,
    fontFamily: fonts.book,
    lineHeight: 20,
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: SURFACE,
    height: 56,
    borderRadius: BUTTON_RADIUS,
    paddingHorizontal: 16,
    color: TEXT,
    fontSize: TYPE_BODY,
    fontFamily: fonts.medium,
    borderWidth: 1,
    borderColor: BORDER,
  },
  cancelBtn: { marginTop: 14, alignItems: "center" },
  cancelText: {
    color: MUTED,
    fontSize: TYPE_LEAD,
    fontFamily: fonts.book,
  },
});
