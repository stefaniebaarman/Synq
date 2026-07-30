import { ONBOARDING_H_PADDING, onboardingContentTopPadding } from "@/constants/onboardingLayout";
import {
  ACCENT,
  BG,
  BUTTON_RADIUS,
  MUTED,
  MUTED3,
  OVERLAY_DARK,
  PRIMARY_CTA_HEIGHT,
  TEXT,
  TEXT_ON_BRIGHT,
  TYPE_BODY,
  TYPE_BUTTON,
  TYPE_DISPLAY,
  fonts,
  synqOutlineAddBtn,
  synqOutlineAddBtnText,
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
const CTA_WIDTH = "72%";

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
          <Text style={styles.title}>
            Let&apos;s <Text style={styles.titleAccent}>Synq.</Text>
          </Text>
          <Text style={styles.sub}>
            Less scrolling, more time with the people{"\n"}
            you care about.
          </Text>
        </View>

        <View style={styles.bottom}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={[synqOutlineAddBtn, styles.primaryBtn]}
            onPress={() => router.push("/(auth)/community-terms?next=phone")}
            accessibilityRole="button"
            accessibilityLabel="Get started"
          >
            <Text style={synqOutlineAddBtnText}>Get started</Text>
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
    letterSpacing: -0.4,
    lineHeight: 40,
  },
  titleAccent: {
    color: ACCENT,
    fontFamily: fonts.heavy,
  },
  sub: {
    marginTop: 16,
    color: MUTED,
    fontFamily: fonts.book,
    fontSize: TYPE_BODY,
    lineHeight: 23,
    width: "92%",
  },
  bottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 48,
    paddingHorizontal: ONBOARDING_H_PADDING,
    alignItems: "center",
  },

  primaryBtn: {
    alignSelf: "center",
    width: CTA_WIDTH,
    height: PRIMARY_CTA_HEIGHT,
    paddingVertical: 0,
    paddingHorizontal: 24,
  },

  secondaryBtn: {
    marginTop: 12,
    alignSelf: "center",
    width: CTA_WIDTH,
    height: PRIMARY_CTA_HEIGHT,
    borderRadius: BUTTON_RADIUS,
    backgroundColor: OVERLAY_DARK,
    borderWidth: 1,
    borderColor: MUTED3,
    justifyContent: "center",
    alignItems: "center",
  },

  secondaryText: {
    color: TEXT_ON_BRIGHT,
    fontFamily: fonts.medium,
    fontSize: TYPE_BUTTON,
  },
});
