import { Dimensions } from "react-native";

const { height: WINDOW_HEIGHT } = Dimensions.get("window");

/** Horizontal inset for onboarding form columns (auth + post-auth). */
export const ONBOARDING_H_PADDING = 22;

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
