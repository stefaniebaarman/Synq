import {
  ACCENT,
  BG,
  BUTTON_RADIUS,
  PRIMARY_CTA_HEIGHT,
  PRIMARY_CTA_WIDTH,
  modalBodyText,
  modalTitleText,
  primaryButtonText,
} from "@/constants/Variables";
import { openAppStore } from "@/src/lib/appUpdateGate";
import React from "react";
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const SPLASH_LOGO = require("../assets/logo.png");

type Props = {
  storeUrl: string | null;
};

export default function RequiredUpdateBlocker({ storeUrl }: Props) {
  return (
    <View style={styles.container}>
      <Image source={SPLASH_LOGO} style={styles.logo} resizeMode="contain" />
      <Text style={[modalTitleText, styles.title]}>Update required</Text>
      <Text style={[modalBodyText, styles.message]}>
        A new version of Synq is available. Please update to continue.
      </Text>
      <TouchableOpacity
        style={styles.button}
        activeOpacity={0.85}
        onPress={() => {
          void openAppStore(storeUrl);
        }}
        accessibilityRole="button"
        accessibilityLabel="Update Synq"
      >
        <Text style={primaryButtonText}>Update Synq</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  logo: {
    width: 220,
    height: 160,
    marginBottom: 32,
  },
  title: {
    textAlign: "center",
    marginBottom: 12,
  },
  message: {
    lineHeight: 24,
    textAlign: "center",
    marginBottom: 28,
  },
  button: {
    width: PRIMARY_CTA_WIDTH,
    height: PRIMARY_CTA_HEIGHT,
    borderRadius: BUTTON_RADIUS,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
});
