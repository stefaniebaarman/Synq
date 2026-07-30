import { Dimensions, StyleSheet } from "react-native";
import {
  ACCENT,
  DIVIDER,
  MUTED,
  TEXT,
  TYPE_BODY,
  TYPE_DISPLAY,
  fonts,
  synqOutlineAddBtn,
  synqOutlineAddBtnText,
} from "./Variables";

const { height: WINDOW_HEIGHT } = Dimensions.get("window");

/** Carousel slide count (index / welcome / next). */
export const ONBOARDING_CAROUSEL_STEPS = 3;

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
    paddingBottom: 26,
    alignItems: "center",
  },
  nextBtn: {
    ...synqOutlineAddBtn,
    minWidth: 168,
    paddingHorizontal: 40,
  },
  nextText: {
    ...synqOutlineAddBtnText,
  },
  dots: {
    flexDirection: "row",
    gap: 8,
    marginTop: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: { width: 7, height: 7, borderRadius: 99 },
  dotInactive: { backgroundColor: DIVIDER },
  dotActive: { backgroundColor: ACCENT },
});

/** Top offset for absolute back controls (chevron). */
export const ONBOARDING_BACK_TOP = 56;

/** Left inset for back controls — lines up with form content. */
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
