import { ONBOARDING_H_PADDING } from "@/constants/onboardingLayout";
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
} from "@/constants/Variables";
import { router } from "expo-router";
import React from "react";
import {
  Dimensions,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const CTA_WIDTH = "72%";
const SCREEN_H = Dimensions.get("window").height;
/** Pull headline + CTAs toward the vertical center on this screen only. */
const GET_STARTED_TITLE_TOP = Math.round(SCREEN_H * 0.32);
const GET_STARTED_BUTTONS_BOTTOM = Math.round(SCREEN_H * 0.22);

export default function GetStartedScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={["bottom", "left", "right"]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={BG}
        translucent={Platform.OS === "android"}
      />
      <View style={styles.container}>
        <View
          style={{
            paddingTop: GET_STARTED_TITLE_TOP,
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
  safe: { flex: 1, backgroundColor: BG, overflow: "visible" },
  container: { flex: 1, backgroundColor: BG, overflow: "visible" },

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
    bottom: GET_STARTED_BUTTONS_BOTTOM,
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
