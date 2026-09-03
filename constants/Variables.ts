import { Platform, type TextStyle, type ViewStyle } from "react-native";

export {
  SYNQ_OPEN_WEB_BASE,
  SYNQ_SHARE_HOST,
  SYNQ_SHARE_WEB_BASE
} from "@/src/lib/config";

export const ACCENT = "#00FF85";
/** Text on accent-filled buttons and chips. */
export const ON_ACCENT_TEXT = "#061006";
/**
 * Outgoing chat bubbles — same Synq green family as {@link ACCENT},
 * slightly deeper so large fills don’t read as neon CTA.
 */
export const CHAT_BUBBLE_SELF = "#00D974";
/** Text on {@link CHAT_BUBBLE_SELF}. */
export const CHAT_BUBBLE_SELF_TEXT = ON_ACCENT_TEXT;
/** Destructive actions: delete, block, end synq, swipe delete. */
export const DESTRUCTIVE = "#FF453A";
/** Solid black behind status bar in tab header overlays. */
export const HEADER_BLACK = "#000000";
/** Header icon glyph size (notifications, settings, messages, options). */
export const HEADER_ICON_SIZE = 26;
export const DEFAULT_AVATAR =
  "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&s=256";
export const EXPIRATION_HOURS = 12;

export const BG = "#090A0B";

export const SURFACES = {
  page: BG,
  card: "#0E1012",
  inset: "#0A0B0D",
  sheet: "#141414",
  elevated: "#1C1C1E",
} as const;

const IS_ANDROID = Platform.OS === "android";
/** Matches interests pill stroke on Android. */
const ANDROID_BORDER = "#333333";
/**
 * Android chrome matches add-interests: solid BG + SURFACE_INPUT wells/cards.
 * Semi-transparent accent/white rgba reads as green on Android dark UI.
 */
const ANDROID_CHROME = {
  SURFACE: SURFACES.inset,
  BORDER: ANDROID_BORDER,
  SURFACE_FAINT: SURFACES.inset,
  SURFACE_SUBTLE: SURFACES.inset,
  SURFACE_MUTED: SURFACES.inset,
  SURFACE_SOFT: SURFACES.card,
  GROUP_BORDER: ANDROID_BORDER,
  BORDER_SOFT: ANDROID_BORDER,
  BORDER_LIGHT: ANDROID_BORDER,
  FRIENDS_BORDER: SURFACES.inset,
  FRIENDS_SEARCH_BORDER: ANDROID_BORDER,
  ACCENT_FILL: SURFACES.card,
  ACCENT_FILL_SUBTLE: SURFACES.inset,
  ACCENT_FILL_MUTED: SURFACES.inset,
  ACCENT_FILL_FAINT: SURFACES.inset,
  ACCENT_FILL_WHISPER: BG,
  ACCENT_FILL_STRONG: SURFACES.elevated,
  ACCENT_SELECTED_BG: SURFACES.card,
  DISABLED_ACCENT_SUBTLE: SURFACES.inset,
  ACCENT_GRADIENT_START: BG,
  ACCENT_GRADIENT_END: BG,
  SHARE_GRADIENT_ACCENT: BG,
  RIPPLE: "#1A1B1D",
} as const;
/** Neutral Android press ripple (avoids Material accent green flash). */
export const ANDROID_RIPPLE = IS_ANDROID
  ? ({ color: ANDROID_CHROME.RIPPLE } as const)
  : undefined;
/** Charcoal behind tab icons and labels (slightly lifted off pure black). */
export const TAB_BAR_BG = "#050607";
/** Tab bar fade: transparent (content) → charcoal (icons). */
export const TAB_BAR_FADE_GRADIENT = [
  "rgba(9,10,11,0)",
  "rgba(5,6,7,0.64)",
  TAB_BAR_BG,
] as const;
/** Profile header fade: black (icons) → page background. */
export const PROFILE_HEADER_FADE_GRADIENT = [
  HEADER_BLACK,
  HEADER_BLACK,
  "rgba(0,0,0,0.96)",
  "rgba(0,0,0,0.72)",
  "rgba(0,0,0,0.38)",
  "rgba(9,10,11,0)",
] as const;
export const PROFILE_HEADER_FADE_LOCATIONS = [0, 0.1, 0.28, 0.5, 0.74, 1] as const;
/** Fade strip height directly under the header icon row. */
export const PROFILE_HEADER_FADE_BELOW_ICONS = 28;
/** Offset from safe-area top to header icon row. */
export const PROFILE_HEADER_TOP_OFFSET = 12;
/** Height of the header icon touch row. */
export const PROFILE_HEADER_ICON_ROW_HEIGHT = 48;
/** Clear space between the fade and scroll content below. */
export const PROFILE_HEADER_CONTENT_GAP = 22;
/** Extra space below the status bar for the messages inbox/thread close row. */
export const MESSAGES_HEADER_EXTRA_TOP = 6;

export function messagesModalHeaderPaddingTop(safeTop: number) {
  return Math.max(safeTop, 20) + MESSAGES_HEADER_EXTRA_TOP;
}

/** Layout metrics for tab screens with floating header overlays. */
export function getTabHeaderLayout(insetsTop: number) {
  const top = insetsTop + PROFILE_HEADER_TOP_OFFSET;
  const iconRowBottom = top + PROFILE_HEADER_ICON_ROW_HEIGHT;
  const gradientHeight = iconRowBottom + PROFILE_HEADER_FADE_BELOW_ICONS;
  const contentPaddingTop = iconRowBottom + PROFILE_HEADER_CONTENT_GAP;
  const titleGradientHeight = iconRowBottom + 16;
  return {
    top,
    iconRowBottom,
    gradientHeight,
    contentPaddingTop,
    titleGradientHeight,
  };
}
/** Extra list/scroll bottom padding when the tab bar is position:absolute. */
export const TAB_BAR_SCROLL_INSET = 96;
export const PRIMARY_CTA_WIDTH = "68%";
export const PRIMARY_CTA_HEIGHT = 56;
export const BUTTON_RADIUS = 14;
export const MODAL_RADIUS = 22;
export const RADIUS_SM = 12;
export const RADIUS_MD = 16;
export const RADIUS_LG = 20;
export const RADIUS_XL = 24;
export const RADIUS_2XL = 28;
export const SPACE_1 = 4;
export const SPACE_2 = 8;
export const SPACE_3 = 12;
export const SPACE_4 = 16;
export const SPACE_5 = 24;
export const SPACE_6 = 32;
export const TEXT = "rgba(255,255,255,0.92)";
export const MUTED = "rgba(255,255,255,0.55)";
export const fonts = {
  heavy: "Avenir-Heavy",
  medium: "Avenir-Medium",
  /** Between Book and Medium — good for chat body copy. */
  roman: "Avenir-Roman",
  book: "Avenir-Book",
  black: "Avenir-Black",
};
export const SURFACE = IS_ANDROID
  ? ANDROID_CHROME.SURFACE
  : "rgba(255,255,255,0.06)";
export const BORDER = IS_ANDROID ? ANDROID_CHROME.BORDER : "rgba(255,255,255,0.08)";
export const MUTED2 = "rgba(255,255,255,0.45)";
export const MUTED3 = "rgba(255,255,255,0.25)";
export const CLOSE_ICON_NAME = "close" as const;
export const CLOSE_ICON_COLOR = TEXT;
export const CLOSE_ICON_SIZE = 24;
export const CLOSE_ICON_COLOR_INLINE = MUTED2;
export const CLOSE_ICON_SIZE_INLINE = 18;

export const navigationCloseBtn: ViewStyle = {
  width: 44,
  height: 44,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "transparent",
};

export const BACK_ICON_NAME = "chevron-back" as const;
export const BACK_ICON_COLOR = TEXT;
export const BACK_ICON_SIZE = 24;
/** Touch target for header back; transparent background. */
export const navigationBackBtn: ViewStyle = {
  width: 44,
  height: 44,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "transparent",
};
export const TYPE_DISPLAY = 34;
export const TYPE_TAB_HEADER = 28;
export const TYPE_TITLE = 26;
export const TYPE_MODAL_TITLE = 22;
export const TYPE_SECTION = 20;
export const TYPE_BODY = 16;
export const TYPE_SUBHEAD = 17;
export const TYPE_CTA = 18;
export const TYPE_BUTTON = 15;
export const TYPE_LEAD = 14;
export const TYPE_CAPTION = 13;
export const TYPE_FINE = 12;
export const TYPE_MICRO = 11;
export const TYPE_NANO = 9;

/** Raised cards and group list surfaces → interests card gray on Android. */
export const SURFACE_RAISED = IS_ANDROID ? SURFACES.inset : SURFACES.card;
/** Elevated chips, avatars, and input wells → interests inset gray on Android. */
export const SURFACE_ELEVATED = IS_ANDROID ? SURFACES.inset : SURFACES.elevated;
/** Memo and input field backgrounds → {@link SURFACES.inset}. */
export const SURFACE_INPUT = SURFACES.inset;
/** Bottom sheet and action sheet backgrounds → {@link SURFACES.sheet}. */
export const SHEET_SURFACE = IS_ANDROID ? BG : SURFACES.sheet;
export const BORDER_STRONG = "#222";
export const BORDER_MUTED = "#333";
export const TEXT_MUTED_HEX = "#A8A8A8";
/** Calendar and memo muted labels. */
export const TEXT_MUTED_DARK = "#666";
export const TEXT_MUTED_DARKER = "#777";
export const TEXT_MUTED_LIGHT = "#888";
export const TEXT_MUTED_FAINT = "#444";
export const MODAL_OVERLAY = "rgba(0,0,0,0.75)";
/** Bottom sheet scrim (lighter than centered modals). */
export const SHEET_OVERLAY = "rgba(0,0,0,0.55)";
/** Disabled primary CTA fill (iOS system gray). */
export const DISABLED_CTA = "#8E8E93";
export const DISABLED_ACCENT = "rgba(125,255,166,0.30)";
export const DISABLED_ACCENT_SUBTLE = IS_ANDROID
  ? ANDROID_CHROME.DISABLED_ACCENT_SUBTLE
  : "rgba(125,255,166,0.06)";
/** Drop shadow color for elevated cards. */
export const SHADOW = "#000";
export const OVERLAY_DIM = "rgba(0,0,0,0.45)";
export const OVERLAY_NEAR_FULL = "rgba(0,0,0,0.9)";
export const BG_FADE_MID = "rgba(9,10,11,0.5)";
export const BG_FADE_HEAVY = "rgba(9,10,11,0.88)";
export const BG_TRANSPARENT = "rgba(9,10,11,0)";
export const ACCENT_GRADIENT_START = IS_ANDROID
  ? ANDROID_CHROME.ACCENT_GRADIENT_START
  : "rgba(0,255,133,0.14)";
export const ACCENT_GRADIENT_END = IS_ANDROID
  ? ANDROID_CHROME.ACCENT_GRADIENT_END
  : "rgba(0,255,133,0.03)";
export const SHARE_GRADIENT_START = "#101215";
export const SHARE_GRADIENT_ACCENT = IS_ANDROID
  ? ANDROID_CHROME.SHARE_GRADIENT_ACCENT
  : "#0B100E";
export const TEXT_BRIGHT_HEX = "#FFFFFF";
export const OVERLAY_ZERO = "rgba(0,0,0,0)";
export const OVERLAY_SOFT = "rgba(0,0,0,0.08)";
export const OVERLAY_MID = "rgba(0,0,0,0.65)";
export const OVERLAY_CHAT_TOP = "rgba(0,0,0,0.94)";
export const OVERLAY_FADE = "rgba(0,0,0,0.42)";
export const OVERLAY_TINT = "rgba(0,0,0,0.35)";
export const OVERLAY_WHISPER = "rgba(0,0,0,0.16)";
export const DESTRUCTIVE_IOS_FILL = "rgba(255, 59, 48, 0.15)";
export const ACCENT_SUBTLE = "rgba(0,255,133,0.28)";
/** Selected row tint on accent-bordered lists. */
export const ACCENT_SELECTED_BG = IS_ANDROID
  ? ANDROID_CHROME.ACCENT_SELECTED_BG
  : "rgba(120,255,120,0.08)";
/** Accent borders and fills for chips, selected rows, CTAs. */
export const ACCENT_BORDER = "rgba(0,255,133,0.45)";
export const ACCENT_BORDER_SUBTLE = IS_ANDROID
  ? ANDROID_BORDER
  : "rgba(0,255,133,0.22)";
export const ACCENT_BORDER_MUTED = IS_ANDROID
  ? ANDROID_BORDER
  : "rgba(0,255,133,0.1)";
export const ACCENT_FILL = IS_ANDROID
  ? ANDROID_CHROME.ACCENT_FILL
  : "rgba(0,255,133,0.12)";
export const ACCENT_FILL_SUBTLE = IS_ANDROID
  ? ANDROID_CHROME.ACCENT_FILL_SUBTLE
  : "rgba(0,255,133,0.08)";
export const ACCENT_FILL_MUTED = IS_ANDROID
  ? ANDROID_CHROME.ACCENT_FILL_MUTED
  : "rgba(0,255,133,0.06)";
export const ACCENT_FILL_FAINT = IS_ANDROID
  ? ANDROID_CHROME.ACCENT_FILL_FAINT
  : "rgba(0,255,133,0.04)";
export const ACCENT_FILL_WHISPER = IS_ANDROID
  ? ANDROID_CHROME.ACCENT_FILL_WHISPER
  : "rgba(0,255,133,0.02)";
export const ACCENT_ICON = "rgba(0,255,133,0.88)";
export const ACCENT_FILL_STRONG = IS_ANDROID
  ? ANDROID_CHROME.ACCENT_FILL_STRONG
  : "rgba(0,255,133,0.32)";
export const ACCENT_REFRESH_TINT = "rgba(0,255,133,0.58)";
/** Destructive borders and fills. */
export const DESTRUCTIVE_BORDER = "rgba(255,69,58,0.35)";
export const DESTRUCTIVE_BORDER_STRONG = "rgba(255,69,58,0.45)";
export const DESTRUCTIVE_FILL = "rgba(255,69,58,0.12)";
export const DESTRUCTIVE_FILL_SUBTLE = "rgba(255,69,58,0.06)";
/** Modal/sheet scrims. */
export const OVERLAY_DARK = "rgba(0,0,0,0.72)";
export const OVERLAY_HEAVY = "rgba(0,0,0,0.78)";
export const OVERLAY_SCRIM = "rgba(0,0,0,0.88)";
export const OVERLAY_FULL = "rgba(0,0,0,0.95)";
export const OVERLAY_PANEL = "rgba(18,18,18,0.96)";
/** Status available pill. */
export const STATUS_AVAILABLE_FILL = "rgba(52, 211, 153, 0.12)";
export const STATUS_AVAILABLE_BORDER = "rgba(52, 211, 153, 0.28)";
export const STATUS_AVAILABLE = "#34D399";
/** Misc UI chrome. */
export const BORDER_SUBTLE_HEX = "#252525";
export const BORDER_PANEL = "#1B1D20";
export const PLACEHOLDER_DARK = "#555";
export const HEART_LIKE = "#FF2D55";
export const TEXT_ON_BRIGHT = "rgba(255,255,255,0.85)";
export const CHAT_FAILED_SELF = "#8B0000";
export const CHAT_FAILED_OTHER = "#FFB4B4";
export const GROUP_BORDER = IS_ANDROID
  ? ANDROID_CHROME.GROUP_BORDER
  : "rgba(255,255,255,0.06)";
/** Hairline dividers and faint wells. */
export const SURFACE_FAINT = IS_ANDROID
  ? ANDROID_CHROME.SURFACE_FAINT
  : "rgba(255,255,255,0.03)";
export const SURFACE_SUBTLE = IS_ANDROID
  ? ANDROID_CHROME.SURFACE_SUBTLE
  : "rgba(255,255,255,0.04)";
export const SURFACE_MUTED = IS_ANDROID
  ? ANDROID_CHROME.SURFACE_MUTED
  : "rgba(255,255,255,0.05)";
export const SURFACE_SOFT = IS_ANDROID
  ? ANDROID_CHROME.SURFACE_SOFT
  : "rgba(255,255,255,0.07)";
export const BORDER_SOFT = IS_ANDROID
  ? ANDROID_CHROME.BORDER_SOFT
  : "rgba(255,255,255,0.1)";
export const BORDER_LIGHT = IS_ANDROID
  ? ANDROID_CHROME.BORDER_LIGHT
  : "rgba(255,255,255,0.12)";
export const BORDER_HAIRLINE = "rgba(255,255,255,0.14)";
export const DIVIDER = "rgba(255,255,255,0.16)";
export const DIVIDER_STRONG = "rgba(255,255,255,0.22)";
/** Friends tab list/card stroke. */
export const FRIENDS_BORDER = IS_ANDROID
  ? ANDROID_CHROME.FRIENDS_BORDER
  : "rgba(255,255,255,0.035)";
/** Search field stroke on Friends tab. */
export const FRIENDS_SEARCH_BORDER = IS_ANDROID
  ? ANDROID_CHROME.FRIENDS_SEARCH_BORDER
  : "rgba(255,255,255,0.12)";
/** Standard horizontal inset for scrollable screen content. */
export const SCREEN_H_PADDING = SPACE_5;

/** In-scroll section titles (Groups, Me, Friends, plan lists). */
export const listSectionTitle: TextStyle = {
  color: TEXT,
  fontFamily: fonts.heavy,
  fontSize: TYPE_SUBHEAD,
  lineHeight: 22,
  letterSpacing: 0.06,
};

/** Subsections on detail screens (Members, Upcoming). */
export const detailSectionTitle: TextStyle = {
  color: TEXT,
  fontFamily: fonts.heavy,
  fontSize: TYPE_BODY,
  lineHeight: 20,
  letterSpacing: 0.06,
};

/** Primary title on list cards and rows. */
export const cardTitleText: TextStyle = {
  color: TEXT,
  fontFamily: fonts.medium,
  fontSize: TYPE_BODY,
  lineHeight: 20,
  letterSpacing: 0.04,
};

/** Secondary line under card titles (member count, time, location). */
export const cardMetaText: TextStyle = {
  color: MUTED2,
  fontFamily: fonts.book,
  fontSize: TYPE_CAPTION,
  lineHeight: 17,
  letterSpacing: 0.04,
};

/** Profile and community hero names. */
export const profileNameText: TextStyle = {
  color: TEXT,
  fontFamily: fonts.heavy,
  fontSize: 24,
  lineHeight: 30,
  letterSpacing: 0.04,
};

/** Profile subtitle lines (city, category). */
export const profileLocationText: TextStyle = {
  color: MUTED2,
  fontFamily: fonts.book,
  fontSize: TYPE_LEAD,
  lineHeight: 19,
  letterSpacing: 0.04,
};

/** List row primary label (friends, members). */
export const listRowTitleText: TextStyle = {
  color: TEXT,
  fontFamily: fonts.medium,
  fontSize: TYPE_BODY,
  lineHeight: 20,
  letterSpacing: 0.04,
};

/** Body copy and empty states. */
export const bodyBookText: TextStyle = {
  color: TEXT,
  fontFamily: fonts.book,
  fontSize: TYPE_BODY,
  lineHeight: 22,
  letterSpacing: 0.02,
};

/** Secondary expand/collapse links (See all, Show less). */
export const sectionLinkText: TextStyle = {
  color: MUTED,
  fontFamily: fonts.medium,
  fontSize: TYPE_LEAD,
  letterSpacing: 0.04,
};

/** Search fields and subdued placeholders. */
export const searchPlaceholderText: TextStyle = {
  color: MUTED3,
  fontFamily: fonts.book,
  fontSize: TYPE_LEAD,
  lineHeight: 18,
  letterSpacing: 0.02,
};

/** Typed text and placeholders in form TextInputs. */
export const formInputText: TextStyle = {
  color: TEXT,
  fontFamily: fonts.medium,
  fontSize: TYPE_BODY,
  letterSpacing: 0.02,
};

/** Section headings on Me, Friends, and plan lists. */
export const profileScreenSectionTitle: TextStyle = {
  ...listSectionTitle,
  marginBottom: 12,
};

/** Interest tags and Top Synqs names on the Me profile. */
export const profileInterestPillText: TextStyle = {
  color: TEXT,
  fontFamily: fonts.medium,
  fontSize: TYPE_CAPTION,
};

export const profileInterestPillTextActive: TextStyle = {
  color: ACCENT,
  fontFamily: fonts.medium,
  fontSize: TYPE_CAPTION,
};

/** Uppercase muted labels for form/settings field groups. */
export const formSectionLabel: TextStyle = {
  color: MUTED,
  fontSize: TYPE_LEAD,
  fontFamily: fonts.medium,
  textTransform: "uppercase",
  letterSpacing: 1,
};

/** Modal and sheet titles. */
export const modalTitleText: TextStyle = {
  color: TEXT,
  fontSize: TYPE_MODAL_TITLE,
  fontFamily: fonts.heavy,
  letterSpacing: 0.15,
};

/** Modal body and explanatory copy. */
export const modalBodyText: TextStyle = {
  color: MUTED2,
  fontSize: TYPE_LEAD,
  fontFamily: fonts.book,
  lineHeight: 20,
};

/** Primary filled button label (accent background). */
export const primaryButtonText: TextStyle = {
  color: ON_ACCENT_TEXT,
  fontSize: TYPE_BODY,
  fontFamily: fonts.heavy,
};

/** Large CTA label (auth, onboarding). */
export const ctaButtonText: TextStyle = {
  color: ON_ACCENT_TEXT,
  fontSize: TYPE_CTA,
  fontFamily: fonts.heavy,
};

/** Eyebrow kicker above hero copy (inactive Synq, empty states). */
export const eyebrowLabel: TextStyle = {
  color: MUTED,
  fontSize: TYPE_LEAD,
  fontFamily: fonts.heavy,
  textTransform: "uppercase",
  letterSpacing: 1.2,
};

export const tabScreenMainHeaderTitle: TextStyle = {
  color: TEXT,
  fontSize: TYPE_TAB_HEADER,
  fontFamily: fonts.heavy,
  letterSpacing: 0.2,
};

/** Stack screen titles (settings, notifications, profile settings). */
export const stackScreenHeaderTitle: TextStyle = {
  ...modalTitleText,
};

/** In-sheet panel titles (Share with, action sheets). */
export const sheetTitleText: TextStyle = {
  color: TEXT,
  fontSize: TYPE_SUBHEAD,
  fontFamily: fonts.heavy,
  letterSpacing: 0.06,
};

/** Inline sheet header (Change audience, QR scanner). */
export const sheetHeaderTitleText: TextStyle = {
  color: TEXT,
  fontSize: TYPE_BODY,
  fontFamily: fonts.heavy,
};

/** Form / settings hero headings. */
export const heroTitleText: TextStyle = {
  color: TEXT,
  fontSize: TYPE_SECTION,
  fontFamily: fonts.heavy,
  letterSpacing: 0.04,
};

/** Empty state primary line. */
export const emptyStateTitleText: TextStyle = {
  color: TEXT,
  fontSize: TYPE_SECTION,
  fontFamily: fonts.heavy,
  letterSpacing: 0.04,
};

/** Sheet kicker above options (chat inbox actions). */
export const sheetKickerText: TextStyle = {
  color: MUTED2,
  fontSize: TYPE_CAPTION,
  fontFamily: fonts.medium,
  textAlign: "center",
};

/** Secondary / cancel button label. */
export const secondaryButtonText: TextStyle = {
  color: MUTED2,
  fontSize: TYPE_LEAD,
  fontFamily: fonts.medium,
};

/** Compact back control for stack headers (chevron sits closer to the left edge). */
export const stackNavigationBackBtn: ViewStyle = {
  width: 32,
  height: 40,
  alignItems: "flex-start",
  justifyContent: "center",
  backgroundColor: "transparent",
};

/** Shared pill style for low-emphasis destructive actions (End Synq, Sign Out). */
export const destructiveActionBtn: ViewStyle = {
  alignSelf: "center",
  paddingVertical: 14,
  paddingHorizontal: 60,
  borderRadius: MODAL_RADIUS,
  borderWidth: 1.5,
  borderColor: BORDER_STRONG,
  backgroundColor: SURFACE_INPUT,
};

export const destructiveActionBtnText: TextStyle = {
  color: MUTED,
  fontFamily: fonts.heavy,
  fontSize: TYPE_CAPTION,
  letterSpacing: 2,
  textTransform: "uppercase",
};


export const SYNQ_OUTLINE_CTA_RADIUS = 10;

export const synqOutlineAddBtn: ViewStyle = {
  alignSelf: "center",
  minWidth: 58,
  borderWidth: 1,
  borderColor: ACCENT_BORDER,
  borderRadius: SYNQ_OUTLINE_CTA_RADIUS,
  paddingVertical: 13,
  paddingHorizontal: 32,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: ACCENT_FILL_SUBTLE,
};

export const synqOutlineAddBtnCompact: ViewStyle = {
  minWidth: 58,
  borderWidth: 1,
  borderColor: ACCENT_BORDER,
  borderRadius: SYNQ_OUTLINE_CTA_RADIUS,
  paddingVertical: 7,
  paddingHorizontal: 12,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: ACCENT_FILL_SUBTLE,
};

export const synqOutlineAddBtnText: TextStyle = {
  color: ACCENT,
  fontFamily: fonts.medium,
  fontSize: TYPE_BUTTON,
  letterSpacing: 0.1,
};

export const synqOutlineAddBtnTextCompact: TextStyle = {
  color: ACCENT,
  fontFamily: fonts.medium,
  fontSize: TYPE_CAPTION,
  letterSpacing: 0.1,
};

export const synqOutlineAddBtnDisabled: ViewStyle = {
  borderColor: BORDER_SOFT,
  backgroundColor: IS_ANDROID ? SURFACES.inset : "transparent",
};

export const synqOutlineAddBtnTextDisabled: TextStyle = {
  color: MUTED2,
};

/** Circular add icon shell (Friends header add control). */
export const SYNQ_ADD_ICON_SIZE = 34;
export const SYNQ_ADD_ICON_RADIUS = SYNQ_ADD_ICON_SIZE / 2;
/** Glyph size inside {@link synqPlusAddBtn} icon area. */
export const SYNQ_PLUS_ADD_GLYPH_SIZE = 17;

export const synqAddIconBtn: ViewStyle = {
  width: SYNQ_ADD_ICON_SIZE,
  height: SYNQ_ADD_ICON_SIZE,
  borderRadius: SYNQ_ADD_ICON_RADIUS,
  borderWidth: 1,
  borderColor: ACCENT_BORDER,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: ACCENT_FILL_SUBTLE,
};

/** Compact “+ Add” chip (Interests, Open plans, etc.). */
export const synqPlusAddBtn: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  alignSelf: "flex-start",
  borderWidth: 1,
  borderColor: ACCENT_BORDER,
  borderRadius: SYNQ_OUTLINE_CTA_RADIUS,
  paddingRight: 12,
  backgroundColor: ACCENT_FILL_SUBTLE,
  minHeight: SYNQ_ADD_ICON_SIZE,
};

export const synqPlusAddBtnIcon: ViewStyle = {
  width: SYNQ_ADD_ICON_SIZE,
  height: SYNQ_ADD_ICON_SIZE,
  alignItems: "center",
  justifyContent: "center",
};

export const synqPlusAddBtnText: TextStyle = {
  color: ACCENT,
  fontFamily: fonts.medium,
  fontSize: TYPE_CAPTION,
  letterSpacing: 0.1,
};

export interface Friend {
  id: string;
  displayName?: string;
  email?: string;
  imageurl?: string;
  status?: "available" | "inactive";
  memo?: string;
  monthlyMemo?: string;
  interests?: string[];
  mutualCount?: number;
  events?: {
    id: string;
    date: string;
    title: string;
    time?: string;
    location?: string;
    planHostUid?: string;
    joinedFromFriendUid?: string;
    joinedFromId?: string;
    joinedFromIds?: string[];
    joinedFromName?: string;
    joinedFromNames?: string[];
    attendeeDisplayNames?: Record<string, string>;
  }[];
}

export const AI_PLACE_SUGGESTIONS_ENABLED = true;

/** Native builds below this must update (also set Firestore appConfig/global via scripts/set-app-config.mjs). 1.0.9 = build 157. */
export const MINIMUM_NATIVE_BUILD_NUMBER = 157;
export const IOS_APP_STORE_URL =
  "https://apps.apple.com/us/app/synq-see-whos-free/id6757319173";
export const ANDROID_PLAY_STORE_URL =
  "https://play.google.com/store/search?q=Synq&c=apps";

export const INSTAGRAM_URL = "https://www.instagram.com/lets.synq/";
export const TIKTOK_URL = "https://www.tiktok.com/@lets.synq";

export const SYNQ_AI_PILL_LABEL = "Let Synq pick a spot";

export const aiPrompts = [
  "What's the move?",
  "Let Synq pick a spot",
  "Something for this group",
  "Find a place nearby",
  "Not sure where to go?",
];
  
export const popularNow = [
  { label: "Farmers Market", image: require("./farmers-market.jpeg") },
  { label: "Museums", image: require("./museum.jpeg") },
  { label: "Sports Bars", image: require("./sports-bar.jpg") },
  { label: "Coffee Shops", image: require("./coffee.jpeg") },
];

export const OFFSETS = [
      { x: 0, y: 6, z: 4 },
      { x: 18, y: -2, z: 3 },
      { x: 34, y: 10, z: 2 },
      { x: 14, y: 22, z: 1 },
    ];