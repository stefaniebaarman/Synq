import {
  ONBOARDING_BACK_BELOW_INSET,
  ONBOARDING_BACK_LEFT,
  ONBOARDING_DIVIDER_MARGIN_TOP,
  ONBOARDING_DIVIDER_WIDTH,
  ONBOARDING_H_PADDING,
  ONBOARDING_SCROLL_BOTTOM,
  ONBOARDING_TITLE_LETTER_SPACING,
  ONBOARDING_TITLE_LINE_HEIGHT,
  ONBOARDING_TITLE_SIZE,
  onboardingAuthInnerMarginTop,
} from "@/constants/onboardingLayout";
import {
  BG,
  BORDER,
  BUTTON_RADIUS,
  MUTED2,
  MUTED3,
  PRIMARY_CTA_HEIGHT,
  SURFACE,
  TEXT,
  TYPE_BODY,
  TYPE_CAPTION,
  fonts,
  stackNavigationBackBtn,
  synqOutlineAddBtn,
  synqOutlineAddBtnDisabled,
  synqOutlineAddBtnText,
  synqOutlineAddBtnTextDisabled,
} from "@/constants/Variables";
import BackButton from "@/src/components/BackButton";
import { router } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth } from "../../src/lib/firebase";
import { usePreAuthTermsGate } from "../../src/lib/usePreAuthTermsGate";
import AlertModal from "../alert-modal";

const CTA_WIDTH = "56%";

export default function EmailSignup() {
  const insets = useSafeAreaInsets();
  const termsReady = usePreAuthTermsGate("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState<string | undefined>();
  const [alertMessage, setAlertMessage] = useState("");

  const showAlert = (message: string, title?: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  };

  const canContinue = email.trim().length > 3 && password.length >= 6 && !loading;

  const signUp = async () => {
    try {
      setLoading(true);
      const cleanedEmail = email.trim().toLowerCase();
      await createUserWithEmailAndPassword(auth, cleanedEmail, password);
    } catch (e: any) {
      if (__DEV__) {
        console.error("email signup error", e?.code, e?.message);
      }
      showAlert(
        e?.message ?? "Please check your email and password and try again.",
        "Couldn't sign up"
      );
      setLoading(false);
    }
  };

  if (!termsReady) {
    return <View style={styles.root} />;
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.root}>
        <BackButton
          onPress={() => router.back()}
          style={[
            stackNavigationBackBtn,
            styles.backBtn,
            { top: insets.top + ONBOARDING_BACK_BELOW_INSET },
          ]}
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.container}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            onScrollBeginDrag={Keyboard.dismiss}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={[
                styles.inner,
                { marginTop: onboardingAuthInnerMarginTop() },
              ]}
            >
              <Text style={styles.title}>Sign up with email</Text>
              <View style={styles.divider} />

              <View style={styles.fields}>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email"
                  placeholderTextColor={MUTED3}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  style={styles.input}
                />

                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password (6+ characters)"
                  placeholderTextColor={MUTED3}
                  secureTextEntry
                  textContentType="newPassword"
                  style={[styles.input, styles.passwordInput]}
                />
              </View>

              <TouchableOpacity
                disabled={!canContinue}
                onPress={signUp}
                activeOpacity={0.85}
                style={[
                  synqOutlineAddBtn,
                  styles.primaryButton,
                  !canContinue && synqOutlineAddBtnDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Continue"
              >
                <Text
                  style={[
                    synqOutlineAddBtnText,
                    !canContinue && synqOutlineAddBtnTextDisabled,
                    loading && { opacity: 0.5 },
                  ]}
                >
                  Continue
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
  root: { flex: 1, backgroundColor: BG, overflow: "visible" },

  backBtn: {
    position: "absolute",
    left: ONBOARDING_BACK_LEFT,
    zIndex: 10,
  },
  container: { flex: 1, paddingHorizontal: ONBOARDING_H_PADDING },
  scrollContent: { flexGrow: 1, paddingBottom: ONBOARDING_SCROLL_BOTTOM },
  inner: { width: "100%" },
  title: {
    color: TEXT,
    fontSize: ONBOARDING_TITLE_SIZE,
    fontFamily: fonts.heavy,
    letterSpacing: ONBOARDING_TITLE_LETTER_SPACING,
    lineHeight: ONBOARDING_TITLE_LINE_HEIGHT,
  },
  divider: {
    marginTop: ONBOARDING_DIVIDER_MARGIN_TOP,
    height: 1,
    backgroundColor: BORDER,
    width: ONBOARDING_DIVIDER_WIDTH,
  },
  fields: {
    marginTop: 28,
  },
  input: {
    color: TEXT,
    backgroundColor: SURFACE,
    height: 56,
    borderRadius: BUTTON_RADIUS,
    paddingHorizontal: 16,
    fontSize: TYPE_BODY,
    fontFamily: fonts.medium,
    borderWidth: 1,
    borderColor: BORDER,
  },
  passwordInput: {
    marginTop: 12,
  },
  primaryButton: {
    marginTop: 26,
    alignSelf: "center",
    width: CTA_WIDTH,
    height: PRIMARY_CTA_HEIGHT,
    paddingVertical: 0,
    paddingHorizontal: 24,
  },
  helper: {
    marginTop: 18,
    color: MUTED2,
    fontSize: TYPE_CAPTION,
    textAlign: "center",
    lineHeight: 18,
    fontFamily: fonts.book,
  },
});
