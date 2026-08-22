import {
  ONBOARDING_BACK_BELOW_INSET,
  ONBOARDING_BACK_LEFT,
  ONBOARDING_DIVIDER_MARGIN_TOP,
  ONBOARDING_DIVIDER_WIDTH,
  ONBOARDING_H_PADDING,
  ONBOARDING_SCROLL_BOTTOM,
  ONBOARDING_SUBTITLE_MARGIN_TOP,
  ONBOARDING_SUBTITLE_SIZE,
  ONBOARDING_TITLE_LETTER_SPACING,
  ONBOARDING_TITLE_LINE_HEIGHT,
  ONBOARDING_TITLE_SIZE,
  onboardingAuthInnerMarginTop,
} from "@/constants/onboardingLayout";
import {
  ACCENT,
  BG,
  BORDER,
  BUTTON_RADIUS,
  DISABLED_ACCENT_SUBTLE,
  MUTED,
  MUTED2,
  MUTED3,
  PRIMARY_CTA_HEIGHT,
  SURFACE,
  TEXT,
  TYPE_BODY,
  TYPE_BUTTON,
  TYPE_CAPTION,
  TYPE_MODAL_TITLE,
  fonts,
  stackNavigationBackBtn,
  synqOutlineAddBtn,
  synqOutlineAddBtnDisabled,
  synqOutlineAddBtnText,
  synqOutlineAddBtnTextDisabled,
  synqSvg,
} from "@/constants/Variables";
import BackButton from "@/src/components/BackButton";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FirebaseRecaptchaVerifierModal } from "expo-firebase-recaptcha";
import { router, useLocalSearchParams } from "expo-router";
import { signInWithPhoneNumber } from "firebase/auth";
import { useEffect, useRef, useState } from "react";
import {
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SvgXml } from "react-native-svg";
import { app, auth, firebaseConfig } from "../../src/lib/firebase";
import { usePreAuthTermsGate } from "../../src/lib/usePreAuthTermsGate";
import AlertModal from "../alert-modal";

const { width } = Dimensions.get("window");
const CTA_WIDTH = "56%";
/** Fixed to US/Canada — free-text country codes invite SMS abuse. */
const LOCKED_COUNTRY_CODE = "+1";
const SMS_RESEND_COOLDOWN_MS = 45_000;
const SMS_DAILY_LIMIT = 5;
const SMS_DAILY_KEY = "synq:sms-send-day";

type SmsDayBucket = { day: string; count: number };

function utcDayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

async function readSmsDayBucket(): Promise<SmsDayBucket> {
  try {
    const raw = await AsyncStorage.getItem(SMS_DAILY_KEY);
    if (!raw) return { day: utcDayKey(), count: 0 };
    const parsed = JSON.parse(raw) as SmsDayBucket;
    if (!parsed?.day || typeof parsed.count !== "number") {
      return { day: utcDayKey(), count: 0 };
    }
    if (parsed.day !== utcDayKey()) return { day: utcDayKey(), count: 0 };
    return parsed;
  } catch {
    return { day: utcDayKey(), count: 0 };
  }
}

async function assertSmsDailyAllowance(): Promise<void> {
  const bucket = await readSmsDayBucket();
  if (bucket.count >= SMS_DAILY_LIMIT) {
    throw new Error(
      "Daily SMS limit reached on this device. Try again tomorrow or sign in with email."
    );
  }
}

async function recordSmsSend(): Promise<void> {
  const bucket = await readSmsDayBucket();
  const next = { day: utcDayKey(), count: bucket.count + 1 };
  await AsyncStorage.setItem(SMS_DAILY_KEY, JSON.stringify(next));
}

function formatUsPhoneDisplay(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

export default function Phone() {
  const insets = useSafeAreaInsets();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isSignIn = mode === "signin";
  const termsReady = usePreAuthTermsGate("phone", { enabled: !isSignIn });
  const [phoneNumber, setPhoneNumber] = useState("");
  const countryCode = LOCKED_COUNTRY_CODE;
  const [confirm, setConfirm] = useState<any>(null);
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const autofillInputRef = useRef<TextInput | null>(null);
  const recaptchaVerifier = useRef<FirebaseRecaptchaVerifierModal>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldownSec, setResendCooldownSec] = useState(0);
  const lastSmsSentAtRef = useRef(0);
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

  useEffect(() => {
    if (resendCooldownSec <= 0) return;
    const timer = setTimeout(() => {
      setResendCooldownSec((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [resendCooldownSec]);

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

    const sinceLast = Date.now() - lastSmsSentAtRef.current;
    if (lastSmsSentAtRef.current > 0 && sinceLast < SMS_RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((SMS_RESEND_COOLDOWN_MS - sinceLast) / 1000);
      showAlert(`Wait ${waitSec}s before requesting another code.`, "Slow down");
      return null;
    }

    await assertSmsDailyAllowance();

    const confirmation = await signInWithPhoneNumber(
      auth,
      formattedPhoneNumber,
      recaptchaVerifier.current as any
    );
    await recordSmsSend();
    lastSmsSentAtRef.current = Date.now();
    setResendCooldownSec(Math.ceil(SMS_RESEND_COOLDOWN_MS / 1000));
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
    if (resending || loading || resendCooldownSec > 0) return;

    try {
      setResending(true);
      const confirmation = await requestVerificationCode();
      if (confirmation) {
        showAlert("We sent you a new code.", "Code resent");
      }
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
          {!isCodeSent ? (
            <View style={[styles.innerContent, { marginTop: onboardingAuthInnerMarginTop() }]}>
              <Text style={styles.title}>
                {isSignIn ? "Welcome back" : "What’s your number?"}
              </Text>
              <View style={styles.divider} />
              <View style={styles.inputRow}>
                <View style={styles.countryWrapper}>
                  <Text style={styles.countryInput}>{countryCode}</Text>
                </View>

                <View style={styles.phoneWrapper}>
                  <TextInput
                    value={formatUsPhoneDisplay(phoneNumber)}
                    onChangeText={handlePhoneNumberChange}
                    style={styles.phoneInput}
                    keyboardType="phone-pad"
                    placeholder="555 555 0100"
                    placeholderTextColor={MUTED3}
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
                  synqOutlineAddBtn,
                  styles.primaryButton,
                  (loading || phoneNumber.length < 10) &&
                    synqOutlineAddBtnDisabled,
                ]}
                disabled={loading || phoneNumber.length < 10}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Send code"
              >
                <Text
                  style={[
                    synqOutlineAddBtnText,
                    (loading || phoneNumber.length < 10) &&
                      synqOutlineAddBtnTextDisabled,
                    loading && { opacity: 0.5 },
                  ]}
                >
                  Send code
                </Text>
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
                  disabled={loading || resending || resendCooldownSec > 0}
                  style={styles.linkBtnInline}
                >
                  <Text
                    style={[
                      styles.linkText,
                      (loading || resending || resendCooldownSec > 0) &&
                        styles.linkTextDisabled,
                      resending && { opacity: 0.5 },
                    ]}
                  >
                    {resendCooldownSec > 0
                      ? `Resend in ${resendCooldownSec}s`
                      : "Resend code"}
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={verifyCode}
                style={[
                  synqOutlineAddBtn,
                  styles.primaryButton,
                  (loading || code.join("").length < 6) &&
                    synqOutlineAddBtnDisabled,
                ]}
                disabled={loading || code.join("").length < 6}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    synqOutlineAddBtnText,
                    (loading || code.join("").length < 6) &&
                      synqOutlineAddBtnTextDisabled,
                    loading && { opacity: 0.5 },
                  ]}
                >
                  Continue
                </Text>
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
    letterSpacing: ONBOARDING_TITLE_LETTER_SPACING,
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
    backgroundColor: BORDER,
    width: ONBOARDING_DIVIDER_WIDTH,
  },
  inputRow: { flexDirection: "row", marginTop: 28, height: 58 },
  countryWrapper: {
    backgroundColor: SURFACE,
    borderRadius: BUTTON_RADIUS,
    marginRight: 10,
    width: 74,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: BORDER,
  },
  countryInput: {
    color: TEXT,
    textAlign: "center",
    fontSize: TYPE_BODY,
    fontFamily: fonts.medium,
    paddingVertical: 16,
  },
  phoneWrapper: {
    flex: 1,
    backgroundColor: SURFACE,
    borderRadius: BUTTON_RADIUS,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  phoneInput: {
    color: TEXT,
    fontSize: TYPE_BODY,
    fontFamily: fonts.medium,
    letterSpacing: 0.8,
  },
  helper: {
    color: MUTED2,
    fontSize: TYPE_CAPTION,
    marginTop: 18,
    fontFamily: fonts.book,
    lineHeight: 18,
  },
  primaryButton: {
    alignSelf: "center",
    width: CTA_WIDTH,
    height: PRIMARY_CTA_HEIGHT,
    paddingVertical: 0,
    paddingHorizontal: 24,
    marginTop: 26,
  },
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
    backgroundColor: SURFACE,
    borderRadius: BUTTON_RADIUS,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: BORDER,
  },
  otpDigit: {
    fontSize: TYPE_MODAL_TITLE,
    color: TEXT,
    fontFamily: fonts.heavy,
  },
  otpBoxFilled: {
    borderColor: ACCENT,
    backgroundColor: DISABLED_ACCENT_SUBTLE,
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
  linkDivider: { color: MUTED3, fontSize: TYPE_BUTTON },
  linkText: { color: ACCENT, fontSize: TYPE_BUTTON, fontFamily: fonts.medium },
  linkTextDisabled: { opacity: 0.45 },
});
