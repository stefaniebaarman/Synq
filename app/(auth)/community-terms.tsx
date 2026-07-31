import {
  ONBOARDING_BACK_BELOW_INSET,
  ONBOARDING_BACK_LEFT,
  ONBOARDING_H_PADDING,
  onboardingContentTopPadding,
} from "@/constants/onboardingLayout";
import {
  ACCENT,
  BG,
  BORDER_LIGHT,
  BORDER_SOFT,
  MUTED,
  ON_ACCENT_TEXT,
  PRIMARY_CTA_HEIGHT,
  SPACE_3,
  SPACE_4,
  SPACE_5,
  SURFACE,
  TEXT,
  TYPE_LEAD,
  TYPE_TITLE,
  fonts,
  RADIUS_MD,
  stackNavigationBackBtn,
  synqOutlineAddBtn,
  synqOutlineAddBtnDisabled,
  synqOutlineAddBtnText,
  synqOutlineAddBtnTextDisabled,
} from "@/constants/Variables";
import { useAuthRefresh } from "../_layout";
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
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type NextRoute = "phone" | "login" | "email";

const CTA_WIDTH = "72%";

export default function CommunityTermsScreen() {
  const insets = useSafeAreaInsets();
  const { markCommunityTermsOk } = useAuthRefresh();
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
          if (!cancelled) {
            markCommunityTermsOk();
            router.replace("/(tabs)");
          }
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [isPostAuth, markCommunityTermsOk]);

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
        markCommunityTermsOk();
        router.replace("/(tabs)");
        return;
      }
      continueToAuth();
    } catch {
      if (isPostAuth && auth.currentUser) {
        markCommunityTermsOk();
        router.replace("/(tabs)");
      } else {
        continueToAuth();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const canContinue = checked && !submitting;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      {!isPostAuth ? (
        <BackButton
          onPress={() => router.back()}
          style={[
            stackNavigationBackBtn,
            styles.backBtn,
            { top: insets.top + ONBOARDING_BACK_BELOW_INSET },
          ]}
        />
      ) : null}

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={[
            styles.title,
            { paddingTop: Math.max(72, onboardingContentTopPadding() - 40) },
          ]}
        >
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
            {checked ? <Ionicons name="checkmark" size={16} color={ON_ACCENT_TEXT} /> : null}
          </View>
          <Text style={styles.checkLabel}>
            I agree to the Terms & Conditions and Privacy Policy
          </Text>
        </Pressable>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={[
            synqOutlineAddBtn,
            styles.primaryBtn,
            !canContinue && synqOutlineAddBtnDisabled,
          ]}
          disabled={!canContinue}
          onPress={handleContinue}
          accessibilityRole="button"
          accessibilityLabel={
            isPostAuth ? "Continue to Synq" : "Continue"
          }
        >
          <Text
            style={[
              synqOutlineAddBtnText,
              !canContinue && synqOutlineAddBtnTextDisabled,
              submitting && { opacity: 0.5 },
            ]}
          >
            {isPostAuth ? "Continue to Synq" : "Continue"}
          </Text>
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
    left: ONBOARDING_BACK_LEFT,
    zIndex: 10,
  },
  scroll: {
    paddingHorizontal: ONBOARDING_H_PADDING,
    paddingBottom: SPACE_5,
  },
  title: {
    color: TEXT,
    fontFamily: fonts.heavy,
    fontSize: TYPE_TITLE,
    letterSpacing: -0.3,
    lineHeight: 32,
  },
  sub: {
    marginTop: SPACE_3,
    color: MUTED,
    fontFamily: fonts.book,
    fontSize: TYPE_LEAD,
    lineHeight: 21,
  },
  card: {
    marginTop: SPACE_5,
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderRadius: RADIUS_MD,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER_SOFT,
    gap: SPACE_3,
  },
  cardLead: {
    color: ACCENT,
    fontFamily: fonts.medium,
    fontSize: TYPE_LEAD,
    lineHeight: 21,
  },
  cardBody: {
    color: TEXT,
    fontFamily: fonts.book,
    fontSize: TYPE_LEAD,
    lineHeight: 21,
  },
  links: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    marginTop: SPACE_4,
  },
  link: {
    color: ACCENT,
    fontFamily: fonts.medium,
    fontSize: TYPE_LEAD,
    textDecorationLine: "underline",
  },
  linkSep: { color: MUTED, fontFamily: fonts.medium, fontSize: TYPE_LEAD },
  checkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: SPACE_5,
    gap: SPACE_3,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: BORDER_LIGHT,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkboxOn: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  checkLabel: {
    flex: 1,
    color: TEXT,
    fontFamily: fonts.book,
    fontSize: TYPE_LEAD,
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: ONBOARDING_H_PADDING,
    paddingBottom: 40,
    paddingTop: SPACE_3,
    alignItems: "center",
  },
  primaryBtn: {
    alignSelf: "center",
    width: CTA_WIDTH,
    height: PRIMARY_CTA_HEIGHT,
    paddingVertical: 0,
    paddingHorizontal: 24,
  },
});
