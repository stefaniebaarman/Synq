import { StyleSheet } from "react-native";
import {
  ACCENT,
  BUTTON_RADIUS,
  ON_ACCENT_TEXT,
  PRIMARY_CTA_HEIGHT,
  PRIMARY_CTA_WIDTH,
  ctaButtonText,
  primaryButtonText,
} from "./Variables";

export const buttonStyles = StyleSheet.create({
  primary: {
    backgroundColor: ACCENT,
    borderRadius: BUTTON_RADIUS,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryCompact: {
    backgroundColor: ACCENT,
    borderRadius: BUTTON_RADIUS,
    paddingVertical: 12,
    paddingHorizontal: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryCta: {
    alignSelf: "center",
    width: PRIMARY_CTA_WIDTH,
    height: PRIMARY_CTA_HEIGHT,
    backgroundColor: ACCENT,
    borderRadius: BUTTON_RADIUS,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: primaryButtonText,
  ctaText: ctaButtonText,
});
