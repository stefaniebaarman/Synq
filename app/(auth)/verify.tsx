import BackButton from "@/src/components/BackButton";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { PhoneAuthProvider, signInWithCredential } from "firebase/auth";
import React, { useEffect, useMemo, useState } from "react";
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

import {
  onboardingAuthInnerMarginTop,
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
} from "@/constants/onboardingLayout";
import {
  ACCENT,
  BG,
  BORDER,
  BUTTON_RADIUS,
  DISABLED_ACCENT,
  MUTED,
  MUTED3,
  ON_ACCENT_TEXT,
  PRIMARY_CTA_HEIGHT,
  PRIMARY_CTA_WIDTH,
  SURFACE,
  TEXT,
  TYPE_CTA,
  fonts,
  stackNavigationBackBtn,
} from "@/constants/Variables";
import AlertModal from "../alert-modal";
import { auth } from "../../src/lib/firebase";
import { syncMyPhoneHash } from "../../src/lib/matchContacts";

export default function Verify() {
  const insets = useSafeAreaInsets();
  const { verificationId, phone } = useLocalSearchParams<{ verificationId?: string; phone?: string }>();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");

  const canVerify = useMemo(
    () => verificationId && code.replace(/\D/g, "").length >= 6 && !loading,
    [verificationId, code, loading]
  );

  useEffect(() => {
    if (!verificationId) {
      router.replace("/(auth)/phone");
    }
  }, [verificationId]);

  const verify = async () => {
    if (!verificationId) return;

    try {
      setLoading(true);
      const credential = PhoneAuthProvider.credential(verificationId, code);
      await signInWithCredential(auth, credential);
      try {
        await syncMyPhoneHash();
      } catch {
        // Index sync can retry later from contacts matcher / Auth trigger.
      }

      router.replace("/(auth)/getting-started");
    } catch (err: any) {
      if (__DEV__) {
        console.error("verify error", err);
      }
      setAlertMessage(err?.message ?? "Please try again.");
      setAlertVisible(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <BackButton
          onPress={() => router.back()}
          style={[
            stackNavigationBackBtn,
            styles.backBtn,
            { top: insets.top + ONBOARDING_BACK_BELOW_INSET },
          ]}
        />
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: onboardingAuthInnerMarginTop(),
              paddingHorizontal: ONBOARDING_H_PADDING,
              paddingBottom: ONBOARDING_SCROLL_BOTTOM,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScrollBeginDrag={Keyboard.dismiss}
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        >
          <View style={styles.inner}>
            <Text style={styles.title}>Enter code</Text>
            <View style={styles.divider} />
            <Text style={styles.subtitle}>Sent to {phone ?? "your phone"}.</Text>

            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="123456"
              placeholderTextColor={MUTED3}
              keyboardType="number-pad"
              style={styles.input}
              maxLength={6}
            />

            <TouchableOpacity
              disabled={!canVerify}
              onPress={verify}
              activeOpacity={0.85}
              style={[styles.primaryButton, !canVerify && styles.primaryButtonDisabled]}
            >
              <Text style={[styles.primaryButtonText, loading && { opacity: 0.5 }]}>
                Verify
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
        <AlertModal
          visible={alertVisible}
          title="Invalid code"
          message={alertMessage}
          onClose={() => setAlertVisible(false)}
        />
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  scrollContent: {
    flexGrow: 1,
  },
  inner: { width: "100%" },
  title: {
    fontSize: ONBOARDING_TITLE_SIZE,
    lineHeight: ONBOARDING_TITLE_LINE_HEIGHT,
    fontFamily: fonts.heavy,
    color: TEXT,
    letterSpacing: ONBOARDING_TITLE_LETTER_SPACING,
  },
  divider: {
    marginTop: ONBOARDING_DIVIDER_MARGIN_TOP,
    height: 1,
    backgroundColor: BORDER,
    width: ONBOARDING_DIVIDER_WIDTH,
  },
  subtitle: {
    marginTop: ONBOARDING_SUBTITLE_MARGIN_TOP,
    fontSize: ONBOARDING_SUBTITLE_SIZE,
    color: MUTED,
    fontFamily: fonts.book,
    lineHeight: 22,
  },
  input: {
    marginTop: 20,
    backgroundColor: SURFACE,
    height: 56,
    borderRadius: BUTTON_RADIUS,
    paddingHorizontal: 16,
    color: TEXT,
    fontSize: TYPE_CTA,
    letterSpacing: 4,
    fontFamily: fonts.medium,
    borderWidth: 1,
    borderColor: BORDER,
  },
  primaryButton: {
    marginTop: 22,
    alignSelf: "center",
    width: PRIMARY_CTA_WIDTH,
    height: PRIMARY_CTA_HEIGHT,
    borderRadius: BUTTON_RADIUS,
    backgroundColor: ACCENT,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryButtonDisabled: { backgroundColor: DISABLED_ACCENT },
  primaryButtonText: {
    color: ON_ACCENT_TEXT,
    fontSize: TYPE_CTA,
    fontFamily: fonts.heavy,
    letterSpacing: 0.2,
  },
  backBtn: {
    position: "absolute",
    left: ONBOARDING_BACK_LEFT,
    zIndex: 10,
  },
});
