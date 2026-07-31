import { Dimensions, StyleSheet } from "react-native";
import {
  ACCENT,
  ACCENT_BORDER,
  ACCENT_FILL_SUBTLE,
  BUTTON_RADIUS,
  DIVIDER,
  MUTED,
  TEXT,
  TYPE_BODY,
  TYPE_DISPLAY,
  fonts,
} from "./Variables";

const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get("window");

/** Carousel slide count (index / welcome / next). */
export const ONBOARDING_CAROUSEL_STEPS = 3;

/** Shared hero band for immersive carousel slides. */
export const ONBOARDING_HERO_TOP = Math.round(WINDOW_HEIGHT * 0.2);
/** Tighter top for taller hero content (friend list, chat). */
export const ONBOARDING_HERO_TOP_COMPACT = Math.round(WINDOW_HEIGHT * 0.1);
export const ONBOARDING_HERO_WIDTH = Math.min(
  WINDOW_WIDTH - 44,
  340
);
export const ONBOARDING_PULSE_SIZE = Math.min(WINDOW_WIDTH * 0.74, 290);

/** Shared swipe thresholds for onboarding carousel screens. */
export const ONBOARDING_SWIPE_DISTANCE = 60;
export const ONBOARDING_SWIPE_VELOCITY = 700;

/** Horizontal inset for onboarding form columns (auth + post-auth). */
export const ONBOARDING_H_PADDING = 22;

/** Shared chrome for the three carousel slides. */
export const onboardingCarouselStyles = StyleSheet.create({
  skip: { position: "absolute", top: 14, right: 18, zIndex: 10 },
  skipText: {
    color: MUTED,
    fontFamily: fonts.book,
    fontSize: TYPE_BODY,
  },
  topCopy: { paddingTop: 86 },
  title: {
    color: TEXT,
    fontFamily: fonts.heavy,
    fontSize: TYPE_DISPLAY,
    letterSpacing: -0.4,
    lineHeight: 40,
  },
  sub: {
    marginTop: 16,
    color: MUTED,
    fontFamily: fonts.book,
    fontSize: TYPE_BODY,
    lineHeight: 23,
    maxWidth: 320,
  },
  bottom: {
    paddingBottom: 56,
    alignItems: "center",
  },
  nextBtn: {
    alignSelf: "center",
    width: 200,
    height: 52,
    borderRadius: BUTTON_RADIUS,
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
    backgroundColor: ACCENT_FILL_SUBTLE,
    alignItems: "center",
    justifyContent: "center",
  },
  nextText: {
    color: ACCENT,
    fontFamily: fonts.medium,
    fontSize: TYPE_BODY,
    letterSpacing: 0.15,
  },
  dots: {
    flexDirection: "row",
    gap: 8,
    marginTop: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: { width: 7, height: 7, borderRadius: 99 },
  dotInactive: { backgroundColor: DIVIDER },
  dotActive: { backgroundColor: ACCENT },
});

/** Top offset for absolute back controls (chevron). */
export const ONBOARDING_BACK_TOP = 56;

export const ONBOARDING_BACK_LEFT = ONBOARDING_H_PADDING;

/** Scroll bottom padding for keyboard clearance. */
export const ONBOARDING_SCROLL_BOTTOM = 28;

/**
 * Top padding for screens without a back row (location, details, interests)
 * so headlines line up across the flow.
 */
export function onboardingContentTopPadding(): number {
  return Math.max(112, Math.round(WINDOW_HEIGHT * 0.15));
}

/** First line of content below top safe area on phone/email/login (fraction of screen). */
export function onboardingAuthInnerMarginTop(): number {
  return Math.round(WINDOW_HEIGHT * 0.2);
}

/** Primary headline size for onboarding (matches email / login). */
export const ONBOARDING_TITLE_SIZE = 34;
export const ONBOARDING_TITLE_LINE_HEIGHT = 40;

/** Hairline under title on auth screens. */
export const ONBOARDING_DIVIDER_WIDTH = "78%" as const;
export const ONBOARDING_DIVIDER_MARGIN_TOP = 14;

/** Body line under headline. */
export const ONBOARDING_SUBTITLE_SIZE = 15;
export const ONBOARDING_SUBTITLE_MARGIN_TOP = 14;
