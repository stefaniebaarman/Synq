import { ONBOARDING_H_PADDING, onboardingContentTopPadding } from "@/constants/onboardingLayout";
import {
  ACCENT,
  BG,
  BUTTON_RADIUS,
  ON_ACCENT_TEXT,
  PRIMARY_CTA_HEIGHT,
  TEXT,
  TYPE_BODY,
  TYPE_BUTTON,
  TYPE_CTA,
  TYPE_DISPLAY,
  TYPE_FINE,
  fonts,
  synqSvg,
} from "@/constants/Variables";
import { router } from "expo-router";
import React from "react";
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SvgXml } from "react-native-svg";
const GET_STARTED_CTA_WIDTH = "84%";

export default function GetStartedScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        <View pointerEvents="none" style={styles.bgSvgWrap}>
          <SvgXml xml={synqSvg} width="120%" height="120%" />
        </View>
        <View
          style={{
            paddingTop: onboardingContentTopPadding(),
            paddingHorizontal: ONBOARDING_H_PADDING,
          }}
        >
          <Text style={styles.title}>Let’s Synq.</Text>
          <Text style={styles.sub}>
            Less scrolling, more time with the people{"\n"}
            you care about.
          </Text>
        </View>

        <View style={styles.bottom}>
          <View style={styles.ctaCard}>
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.primaryBtn}
              onPress={() => router.push("/(auth)/community-terms?next=phone")}
            >
              <Text style={styles.primaryText}>Get started</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.secondaryBtn}
              onPress={() => router.push("/(auth)/phone?mode=signin")}
            >
              <Text style={styles.secondaryText}>I already have an account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  container: { flex: 1, backgroundColor: BG },

  bgSvgWrap: {
    position: "absolute",
    top: -55,
    left: -55,
    right: -55,
    bottom: -55,
    opacity: 0.28,
    transform: [{ rotate: "-10deg" }],
  },
  title: {
    color: TEXT,
    fontFamily: fonts.heavy,
    fontSize: TYPE_DISPLAY,
    letterSpacing: -0.8,
    lineHeight: 48,
  },
  sub: {
    marginTop: 14,
    color: "rgba(255,255,255,0.78)",
    fontFamily: fonts.medium,
    fontSize: TYPE_BODY,
    lineHeight: 24,
    width: "92%",
  },
  bottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 28,
    paddingHorizontal: ONBOARDING_H_PADDING,
  },
  ctaCard: {
    borderRadius: 26,
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },

  primaryBtn: {
    alignSelf: "center",
    width: GET_STARTED_CTA_WIDTH,
    height: PRIMARY_CTA_HEIGHT,
    borderRadius: BUTTON_RADIUS,
    backgroundColor: ACCENT,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },

  primaryText: {
    color: ON_ACCENT_TEXT,
    fontFamily: fonts.heavy,
    fontSize: TYPE_CTA,
    letterSpacing: 0.15,
  },

  secondaryBtn: {
    marginTop: 12,
    alignSelf: "center",
    width: GET_STARTED_CTA_WIDTH,
    height: PRIMARY_CTA_HEIGHT,
    borderRadius: BUTTON_RADIUS,
    backgroundColor: "rgba(0,0,0,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    justifyContent: "center",
    alignItems: "center",
  },

  secondaryText: {
    color: "rgba(255,255,255,0.82)",
    fontFamily: fonts.medium,
    fontSize: TYPE_BUTTON,
  },

  micro: {
    marginTop: 12,
    textAlign: "center",
    color: "rgba(255,255,255,0.40)",
    fontFamily: fonts.book,
    fontSize: TYPE_FINE,
  },
});
