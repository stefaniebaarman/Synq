import {
  ONBOARDING_H_PADDING,
  onboardingContentTopPadding,
} from "@/constants/onboardingLayout";
import {
  ACCENT,
  BG,
  BUTTON_RADIUS,
  MUTED,
  ON_ACCENT_TEXT,
  PRIMARY_CTA_HEIGHT,
  SURFACE,
  TEXT,
  TYPE_BODY,
  TYPE_BUTTON,
  TYPE_CTA,
  TYPE_DISPLAY,
  TYPE_LEAD,
  fonts,
} from "@/constants/Variables";
import { auth, db } from "@/src/lib/firebase";
import {
  COMMUNITY_TERMS_VERSION,
  persistCommunityTermsAcceptance,
  setPreAuthTermsAccepted,
} from "@/src/lib/communityTerms";
import BackButton from "@/src/components/BackButton";
import LegalDocumentModal from "@/src/components/legal/LegalDocumentModal";
import PrivacyPolicyContent from "@/src/components/legal/PrivacyPolicyContent";
import TermsContent from "@/src/components/legal/TermsContent";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type NextRoute = "phone" | "login" | "email";

export default function CommunityTermsScreen() {
  const { next, postAuth } = useLocalSearchParams<{
    next?: string;
    postAuth?: string;
  }>();
  const isPostAuth = postAuth === "1" || !!auth.currentUser;
  const nextRoute: NextRoute =
    next === "login" ? "login" : next === "email" ? "email" : "phone";

  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [legalModal, setLegalModal] = useState<"terms" | "privacy" | null>(
    null
  );

  useEffect(() => {
    if (!isPostAuth || !auth.currentUser) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", auth.currentUser!.uid));
        const data = snap.data();
        if (
          data?.communityTermsVersion === COMMUNITY_TERMS_VERSION ||
          data?.communityTermsAcceptedAt
        ) {
          if (!cancelled) router.replace("/(tabs)");
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [isPostAuth]);

  const continueToAuth = () => {
    if (nextRoute === "login") router.replace("/(auth)/login");
    else if (nextRoute === "email") router.replace("/(auth)/email");
    else router.replace("/(auth)/phone");
  };

  const handleContinue = async () => {
    if (!checked || submitting) return;
    setSubmitting(true);
    try {
      await setPreAuthTermsAccepted();
      if (isPostAuth && auth.currentUser) {
        await persistCommunityTermsAcceptance(auth.currentUser.uid);
        router.replace("/(tabs)");
        return;
      }
      continueToAuth();
    } catch {
      if (isPostAuth && auth.currentUser) {
        router.replace("/(tabs)");
      } else {
        continueToAuth();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      {!isPostAuth ? (
        <BackButton onPress={() => router.back()} style={styles.backBtn} />
      ) : null}

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { paddingTop: onboardingContentTopPadding() }]}>
          Community Standards
        </Text>
        <Text style={styles.sub}>
          Before you use Synq, please read and agree to our Terms & Community
          Standards.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardLead}>
            Synq has zero tolerance for objectionable content or abusive users.
          </Text>
          <Text style={styles.cardBody}>
            You may not harass, bully, threaten, impersonate, spam, or share
            unlawful, hateful, exploitative, or sexually explicit content. We
            filter content where possible and review reports from users.
          </Text>
          <Text style={styles.cardBody}>
            Violating content may be removed and accounts may be suspended or
            banned. We aim to act on valid reports within 24 hours.
          </Text>
          <Text style={styles.cardBody}>
            You can report content or block users in the app. Blocking removes
            that person from your feed immediately and notifies our team.
          </Text>
        </View>

        <View style={styles.links}>
          <TouchableOpacity onPress={() => setLegalModal("terms")}>
            <Text style={styles.link}>Terms & Conditions</Text>
          </TouchableOpacity>
          <Text style={styles.linkSep}> · </Text>
          <TouchableOpacity onPress={() => setLegalModal("privacy")}>
            <Text style={styles.link}>Privacy Policy</Text>
          </TouchableOpacity>
        </View>

        <Pressable
          style={styles.checkRow}
          onPress={() => setChecked((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
        >
          <View style={[styles.checkbox, checked && styles.checkboxOn]}>
            {checked ? <Ionicons name="checkmark" size={16} color="#061006" /> : null}
          </View>
          <Text style={styles.checkLabel}>
            I agree to the Terms & Community Standards and confirm there is no
            tolerance for objectionable content or abusive behavior on Synq.
          </Text>
        </Pressable>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          activeOpacity={0.9}
          style={[styles.primaryBtn, (!checked || submitting) && styles.primaryBtnDisabled]}
          disabled={!checked || submitting}
          onPress={handleContinue}
        >
          {submitting ? (
            <ActivityIndicator color="#061006" />
          ) : (
            <Text style={styles.primaryText}>
              {isPostAuth ? "Continue to Synq" : "Agree and continue"}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <LegalDocumentModal
        visible={legalModal === "terms"}
        title="Terms & conditions"
        onClose={() => setLegalModal(null)}
      >
        <TermsContent />
      </LegalDocumentModal>
      <LegalDocumentModal
        visible={legalModal === "privacy"}
        title="Privacy policy"
        onClose={() => setLegalModal(null)}
      >
        <PrivacyPolicyContent />
      </LegalDocumentModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  backBtn: {
    position: "absolute",
    top: 52,
    left: 20,
    zIndex: 10,
  },
  scroll: {
    paddingHorizontal: ONBOARDING_H_PADDING,
    paddingBottom: 24,
  },
  title: {
    color: TEXT,
    fontFamily: fonts.heavy,
    fontSize: TYPE_DISPLAY,
    letterSpacing: -0.5,
    lineHeight: 38,
  },
  sub: {
    marginTop: 12,
    color: "rgba(255,255,255,0.78)",
    fontFamily: fonts.medium,
    fontSize: TYPE_BODY,
    lineHeight: 24,
  },
  card: {
    marginTop: 24,
    padding: 18,
    borderRadius: 16,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  cardLead: {
    color: ACCENT,
    fontFamily: fonts.heavy,
    fontSize: TYPE_BODY,
    lineHeight: 22,
    marginBottom: 12,
  },
  cardBody: {
    color: "rgba(255,255,255,0.88)",
    fontFamily: fonts.medium,
    fontSize: TYPE_BUTTON,
    lineHeight: 22,
    marginBottom: 10,
  },
  links: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    marginTop: 16,
  },
  link: {
    color: ACCENT,
    fontFamily: fonts.medium,
    fontSize: TYPE_BUTTON,
    textDecorationLine: "underline",
  },
  linkSep: { color: MUTED, fontFamily: fonts.medium },
  checkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 24,
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxOn: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  checkLabel: {
    flex: 1,
    color: "rgba(255,255,255,0.9)",
    fontFamily: fonts.medium,
    fontSize: TYPE_LEAD,
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: ONBOARDING_H_PADDING,
    paddingBottom: 28,
    paddingTop: 8,
  },
  primaryBtn: {
    height: PRIMARY_CTA_HEIGHT,
    borderRadius: BUTTON_RADIUS,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryText: {
    color: ON_ACCENT_TEXT,
    fontFamily: fonts.heavy,
    fontSize: TYPE_CTA,
  },
});
