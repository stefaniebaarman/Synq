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
  BUTTON_RADIUS,
  MUTED,
  ON_ACCENT_TEXT,
  PRIMARY_CTA_HEIGHT,
  PRIMARY_CTA_WIDTH,
  TEXT,
  TYPE_BODY,
  TYPE_BUTTON,
  TYPE_CAPTION,
  TYPE_CTA,
  TYPE_MODAL_TITLE,
  fonts,
  synqSvg,
} from "@/constants/Variables";
import BackButton from "@/src/components/BackButton";
import { Ionicons } from "@expo/vector-icons";
import { FirebaseRecaptchaVerifierModal } from "expo-firebase-recaptcha";
import { router, useLocalSearchParams } from "expo-router";
import { signInWithPhoneNumber } from "firebase/auth";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
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
import { SvgXml } from "react-native-svg";
import AlertModal from "../alert-modal";
import { app, auth, firebaseConfig } from "../../src/lib/firebase";
import { usePreAuthTermsGate } from "../../src/lib/usePreAuthTermsGate";

const { width } = Dimensions.get("window");

function formatUsPhoneDisplay(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

export default function Phone() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isSignIn = mode === "signin";
  const termsReady = usePreAuthTermsGate("phone", { enabled: !isSignIn });
  const [phoneNumber, setPhoneNumber] = useState("");
  const [countryCode, setCountryCode] = useState("+1");
  const [confirm, setConfirm] = useState<any>(null);
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const autofillInputRef = useRef<TextInput | null>(null);
  const recaptchaVerifier = useRef<FirebaseRecaptchaVerifierModal>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState<string | undefined>();
  const [alertMessage, setAlertMessage] = useState("");

  const showAlert = (message: string, title?: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  };

  useEffect(() => {
    if (code.join("").length === 6) verifyCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  useEffect(() => {
    if (!isCodeSent) return;
    const timer = setTimeout(() => {
      autofillInputRef.current?.focus();
    }, 350);
    return () => clearTimeout(timer);
  }, [isCodeSent]);

  const applyOtpDigits = (text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, 6);
    const newCode = ["", "", "", "", "", ""];
    digits.split("").forEach((char, index) => {
      newCode[index] = char;
    });
    setCode(newCode);
    if (digits.length === 6) {
      Keyboard.dismiss();
    }
  };

  const handlePhoneNumberChange = (text: string) => {
    setPhoneNumber(text.replace(/\D/g, "").slice(0, 10));
  };

  const getFormattedPhoneNumber = () => {
    const digits = phoneNumber.replace(/\D/g, "");
    if (digits.length !== 10) return null;
    const cc = countryCode.startsWith("+") ? countryCode : `+${countryCode}`;
    return `${cc}${digits}`;
  };

  const requestVerificationCode = async () => {
    if (!recaptchaVerifier.current) return null;

    const formattedPhoneNumber = getFormattedPhoneNumber();
    if (!formattedPhoneNumber) {
      showAlert("Please enter a 10-digit phone number.", "Invalid phone");
      return null;
    }

    const confirmation = await signInWithPhoneNumber(
      auth,
      formattedPhoneNumber,
      recaptchaVerifier.current as any
    );
    setConfirm(confirmation);
    setIsCodeSent(true);
    setCode(["", "", "", "", "", ""]);
    setTimeout(() => autofillInputRef.current?.focus(), 350);
    return confirmation;
  };

  const sendVerificationCode = async () => {
    try {
      setLoading(true);
      await requestVerificationCode();
    } catch (error: any) {
      showAlert(error?.message ?? "Please try again.", "Error");
    } finally {
      setLoading(false);
    }
  };

  const resendVerificationCode = async () => {
    if (resending || loading) return;

    try {
      setResending(true);
      await requestVerificationCode();
      showAlert("We sent you a new code.", "Code resent");
    } catch (error: any) {
      showAlert(error?.message ?? "Please try again.", "Could not resend");
    } finally {
      setResending(false);
    }
  };

  const resetPhoneEntry = () => {
    setIsCodeSent(false);
    setConfirm(null);
    setCode(["", "", "", "", "", ""]);
  };

  const verifyCode = async () => {
    const fullCode = code.join("");
    if (fullCode.length !== 6 || loading || !confirm) return;

    try {
      setLoading(true);
      await confirm.confirm(fullCode);
    } catch (error: any) {
      showAlert("Invalid code. Please try again.", "Error");
      setCode(["", "", "", "", "", ""]);
      autofillInputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const maskedPhone =
    phoneNumber.length === 10
      ? formatUsPhoneDisplay(phoneNumber)
      : "your number";

  const recaptchaConfig = (app as any)?.options ?? firebaseConfig;

  if (!termsReady) {
    return <View style={styles.root} />;
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.root}>
        <View pointerEvents="none" style={styles.bgSvgWrap}>
          <SvgXml xml={synqSvg} width="120%" height="120%" />
        </View>
        <FirebaseRecaptchaVerifierModal
          ref={recaptchaVerifier}
          firebaseConfig={recaptchaConfig}
          attemptInvisibleVerification
        />

        <BackButton onPress={() => router.back()} style={styles.backBtn} />

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
          {!isCodeSent ? (
            <View style={[styles.innerContent, { marginTop: onboardingAuthInnerMarginTop() }]}>
              <Text style={styles.title}>
                {isSignIn ? "Welcome back" : "What’s your\nnumber?"}
              </Text>
              <View style={styles.divider} />
              {isSignIn ? (
                <Text style={styles.subtitle}>Sign in with your phone number</Text>
              ) : null}

              <View style={styles.inputRow}>
                <View style={styles.countryWrapper}>
                  <TextInput
                    value={countryCode}
                    onChangeText={setCountryCode}
                    style={styles.countryInput}
                    keyboardType="phone-pad"
                    placeholder="+1"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                  />
                </View>

                <View style={styles.phoneWrapper}>
                  <TextInput
                    value={formatUsPhoneDisplay(phoneNumber)}
                    onChangeText={handlePhoneNumberChange}
                    style={styles.phoneInput}
                    keyboardType="phone-pad"
                    placeholder="555 555 0100"
                    placeholderTextColor="rgba(255,255,255,0.20)"
                    autoFocus={false}
                  />
                </View>
              </View>

              <Text style={styles.helper}>
                {isSignIn
                  ? "We’ll text you a code to sign in."
                  : "We’ll text you a code to verify your account."}
              </Text>

              <TouchableOpacity
                onPress={sendVerificationCode}
                style={[
                  styles.primaryButton,
                  (loading || phoneNumber.length < 10) && styles.disabledButton,
                ]}
                disabled={loading || phoneNumber.length < 10}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#061006" />
                ) : (
                  <Text style={styles.primaryButtonText}>Send Code</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() =>
                  router.push(isSignIn ? "/(auth)/login" : "/(auth)/email")
                }
                style={styles.linkBtn}
              >
                <Text style={styles.linkText}>
                  {isSignIn
                    ? "Sign in with email instead"
                    : "Sign up with email instead"}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.innerContent, { marginTop: onboardingAuthInnerMarginTop() }]}>
              <Text style={styles.title}>Enter code</Text>
              <View style={styles.divider} />
              <Text style={styles.subtitle}>Sent to {maskedPhone}</Text>

              <View style={styles.otpRow}>
                <TextInput
                  ref={autofillInputRef}
                  value={code.join("")}
                  onChangeText={applyOtpDigits}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete={Platform.OS === "android" ? "sms-otp" : "one-time-code"}
                  importantForAutofill="yes"
                  maxLength={6}
                  caretHidden
                  style={styles.otpAutofillInput}
                  accessibilityLabel="Verification code"
                />
                {code.map((digit, index) => (
                  <TouchableOpacity
                    key={index}
                    activeOpacity={0.85}
                    onPress={() => autofillInputRef.current?.focus()}
                    style={[styles.otpBox, digit !== "" && styles.otpBoxFilled]}
                    accessibilityRole="button"
                    accessibilityLabel={`Digit ${index + 1}`}
                  >
                    <Text style={styles.otpDigit}>{digit}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.otpLinksRow}>
                <TouchableOpacity onPress={resetPhoneEntry} style={styles.linkBtnInline}>
                  <Text style={styles.linkText}>Wrong number?</Text>
                </TouchableOpacity>
                <Text style={styles.linkDivider}>·</Text>
                <TouchableOpacity
                  onPress={resendVerificationCode}
                  disabled={loading || resending}
                  style={styles.linkBtnInline}
                >
                  <Text style={[styles.linkText, (loading || resending) && styles.linkTextDisabled]}>
                    {resending ? "Sending…" : "Resend code"}
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={verifyCode}
                style={[
                  styles.primaryButton,
                  { marginTop: 26 },
                  (loading || code.join("").length < 6) && styles.disabledButton,
                ]}
                disabled={loading || code.join("").length < 6}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#061006" />
                ) : (
                  <Text style={styles.primaryButtonText}>Continue</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
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
  scrollContent: { flexGrow: 1, paddingBottom: ONBOARDING_SCROLL_BOTTOM },
  innerContent: { width: "100%" },
  title: {
    color: TEXT,
    fontSize: ONBOARDING_TITLE_SIZE,
    fontFamily: fonts.heavy,
    lineHeight: ONBOARDING_TITLE_LINE_HEIGHT,
    letterSpacing: 0.2,
  },
  subtitle: {
    color: MUTED,
    fontSize: ONBOARDING_SUBTITLE_SIZE,
    marginTop: ONBOARDING_SUBTITLE_MARGIN_TOP,
    fontFamily: fonts.book,
    lineHeight: 22,
  },
  divider: {
    marginTop: ONBOARDING_DIVIDER_MARGIN_TOP,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    width: ONBOARDING_DIVIDER_WIDTH,
  },
  inputRow: { flexDirection: "row", marginTop: 28, height: 58 },
  countryWrapper: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: BUTTON_RADIUS,
    marginRight: 10,
    width: 74,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  countryInput: {
    color: TEXT,
    textAlign: "center",
    fontSize: TYPE_BODY,
    fontFamily: fonts.medium,
  },
  phoneWrapper: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: BUTTON_RADIUS,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  phoneInput: {
    color: TEXT,
    fontSize: TYPE_BODY,
    fontFamily: fonts.medium,
    letterSpacing: 0.8,
  },
  helper: {
    color: "rgba(255,255,255,0.45)",
    fontSize: TYPE_CAPTION,
    marginTop: 18,
    fontFamily: fonts.book,
    lineHeight: 18,
  },
  primaryButton: {
    alignSelf: "center",
    width: PRIMARY_CTA_WIDTH,
    backgroundColor: ACCENT,
    height: PRIMARY_CTA_HEIGHT,
    borderRadius: BUTTON_RADIUS,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 26,
  },
  primaryButtonText: {
    color: ON_ACCENT_TEXT,
    fontSize: TYPE_CTA,
    fontFamily: fonts.heavy,
    letterSpacing: 0.2,
  },
  disabledButton: { backgroundColor: "rgba(125, 255, 166, 0.30)" },
  otpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 34,
    position: "relative",
  },
  otpAutofillInput: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.02,
    color: "transparent",
    fontSize: TYPE_BODY,
  },
  otpBox: {
    width: width / 8.5,
    height: 58,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: BUTTON_RADIUS,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  otpDigit: {
    fontSize: TYPE_MODAL_TITLE,
    color: TEXT,
    fontFamily: fonts.heavy,
  },
  otpBoxFilled: {
    borderColor: ACCENT,
    backgroundColor: "rgba(125, 255, 166, 0.06)",
  },
  linkBtn: { marginTop: 18, alignSelf: "center" },
  otpLinksRow: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  linkBtnInline: { paddingVertical: 4, paddingHorizontal: 2 },
  linkDivider: { color: "rgba(255,255,255,0.35)", fontSize: TYPE_BUTTON },
  linkText: { color: ACCENT, fontSize: TYPE_BUTTON, fontFamily: fonts.medium },
  linkTextDisabled: { opacity: 0.45 },
});
