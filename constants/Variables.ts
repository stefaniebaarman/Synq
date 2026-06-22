import type { TextStyle, ViewStyle } from "react-native";

export {
  SYNQ_OPEN_WEB_BASE,
  SYNQ_SHARE_HOST,
  SYNQ_SHARE_WEB_BASE,
} from "@/src/lib/config";

export const ACCENT = "#00FF85";
/** Text on accent-filled buttons and chips. */
export const ON_ACCENT_TEXT = "#061006";
/** Destructive actions: delete, block, end synq, swipe delete. */
export const DESTRUCTIVE = "#FF453A";
/** Solid black behind status bar in tab header overlays. */
export const HEADER_BLACK = "#000000";
/** Header icon glyph size (notifications, settings, messages, options). */
export const HEADER_ICON_SIZE = 26;
export const DEFAULT_AVATAR =
  "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&s=256";
export const EXPIRATION_HOURS = 12;
export const synqSvg = `
  <svg width="390" height="565" viewBox="0 0 390 565" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fill-rule="evenodd" clip-rule="evenodd" d="M315.808 523.349C309.142 527.14 300.865 522.325 300.865 514.656V302.238C300.865 298.642 302.796 295.322 305.923 293.545L463.367 204.029C470.033 200.239 478.31 205.053 478.31 212.722V360.975C478.31 362.753 478.783 364.498 479.682 366.032L504.916 409.08C506.747 412.203 506.747 416.072 504.916 419.195L483.3 456.065C480.533 460.784 474.488 462.404 469.732 459.701L453.672 450.573C450.608 448.831 446.852 448.831 443.788 450.574L315.808 523.349ZM349.216 338.697C349.216 335.101 351.147 331.782 354.273 330.004L422.996 290.928C429.662 287.138 437.939 291.953 437.939 299.621V377.51C437.939 381.106 436.008 384.425 432.881 386.203L364.159 425.278C357.493 429.069 349.216 424.254 349.216 416.585V338.697Z" fill="#FFFFFF" fill-opacity="0.07"/>
    <path d="M251.12 195.328C245.103 198.652 237.801 198.652 231.784 195.329L95.7129 120.195C81.9369 112.588 81.9361 92.7866 95.7115 85.1788L116.892 73.4815C120.939 71.2466 125.635 70.4826 130.181 71.3195L240.127 91.5575C251.28 93.6103 256.698 78.4499 246.771 72.9685L214.009 54.8785C200.232 47.2716 200.232 27.4694 214.009 19.8621L231.785 10.0464C237.801 6.72391 245.103 6.72386 251.12 10.0463L387.185 85.1778C400.963 92.7852 400.962 112.589 387.184 120.195L365.3 132.276C361.686 134.271 357.543 135.099 353.439 134.646L261.603 124.506C250.737 123.306 244.101 137.915 255.671 143.2L268.89 150.498C282.666 158.105 282.666 177.906 268.891 185.514L251.12 195.328Z" fill="#FFFFFF" fill-opacity="0.07"/>
    <path d="M206.977 279.648C210.164 281.408 212.143 284.761 212.143 288.402V537.876C212.143 541.517 214.122 544.87 217.31 546.63L236.881 557.436C239.889 559.097 243.54 559.097 246.548 557.436L266.119 546.63C269.307 544.87 271.286 541.517 271.286 537.876V288.402C271.286 284.761 273.265 281.408 276.452 279.648L473.143 171.046C476.331 169.286 478.31 165.932 478.31 162.291V141.433C478.31 137.791 476.33 134.438 473.142 132.678L453.563 121.871C450.555 120.211 446.905 120.211 443.897 121.872L246.548 230.841C243.54 232.502 239.889 232.502 236.881 230.841L39.5239 121.872C36.5156 120.211 32.8651 120.211 29.8568 121.872L10.2856 132.678C7.09815 134.438 5.11914 137.791 5.11914 141.432V162.291C5.11914 165.932 7.09812 169.286 10.2855 171.046L206.977 279.648Z" fill="#FFFFFF" fill-opacity="0.07"/>
    <path d="M5.11914 298.827V217.8C5.11914 210.186 13.2878 205.366 19.9526 209.045L177.397 295.975C180.584 297.735 182.563 301.088 182.563 304.729V347.207C182.563 354.82 174.394 359.641 167.729 355.961L79.1043 307.019C72.4394 303.339 64.2701 308.159 64.2701 315.773V325.588C64.2701 329.229 66.249 332.583 69.4364 334.343L177.397 393.954C180.585 395.714 182.563 399.068 182.563 402.709V510.505C182.563 518.118 174.395 522.939 167.73 519.259L10.2854 432.322C7.09804 430.562 5.11914 427.209 5.11914 423.568V381.097C5.11914 373.484 13.288 368.663 19.9529 372.343L108.579 421.279C115.244 424.959 123.413 420.138 123.413 412.525V402.709C123.413 399.068 121.434 395.714 118.246 393.954L10.2854 334.343C7.09806 332.583 5.11914 329.229 5.11914 325.588V298.827Z" fill="#FFFFFF" fill-opacity="0.07"/>
  </svg>
`;

export const BG = "#090A0B";
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

/** Layout metrics for tab screens with floating header overlays. */
export function getTabHeaderLayout(insetsTop: number) {
  const top = insetsTop + PROFILE_HEADER_TOP_OFFSET;
  const iconRowBottom = top + PROFILE_HEADER_ICON_ROW_HEIGHT;
  const gradientHeight = iconRowBottom + PROFILE_HEADER_FADE_BELOW_ICONS;
  const contentPaddingTop = iconRowBottom + PROFILE_HEADER_CONTENT_GAP;
  /** Gradient height for title/icon rows (Friends, Synq active) — ends at icon row bottom. */
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
  book: "Avenir-Book",
  black: "Avenir-Black",
};
export const SURFACE = "rgba(255,255,255,0.06)";
export const BORDER = "rgba(255,255,255,0.08)";
export const MUTED2 = "rgba(255,255,255,0.45)";
export const MUTED3 = "rgba(255,255,255,0.25)";
/** Dismiss “X” — white glyph, no chrome (matches back). */
export const CLOSE_ICON_NAME = "close" as const;
export const CLOSE_ICON_COLOR = TEXT;
export const CLOSE_ICON_SIZE = 24;
/** Inline clear in search fields — smaller, muted. */
export const CLOSE_ICON_COLOR_INLINE = MUTED2;
export const CLOSE_ICON_SIZE_INLINE = 18;
/** Touch target for header / sheet close; transparent background. */
export const navigationCloseBtn: ViewStyle = {
  width: 44,
  height: 44,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "transparent",
};
/** Navigation back (“<”) — white glyph, no chrome. */
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

/** Raised cards and group list surfaces. */
export const SURFACE_RAISED = "#0E1012";
/** Elevated chips, avatars, and input wells. */
export const SURFACE_ELEVATED = "#1C1C1E";
/** Memo and input field backgrounds. */
export const SURFACE_INPUT = "#0A0B0D";
/** Deep wells in community/memo modals. */
export const SURFACE_DEEP = "#0c0c0c";
/** Deepest inset wells (memo footer, modal footers). */
export const SURFACE_DEEPER = "#050505";
/** Bottom sheet and action sheet backgrounds. */
export const SHEET_SURFACE = "#141414";
/** Alternate sheet surface (report modal, explore panels). */
export const SURFACE_SHEET_ALT = "#161616";
/** Inset card backgrounds (community plans, explore). */
export const SURFACE_INSET = "#101214";
/** Avatar wells and icon circles. */
export const SURFACE_WELL = "#111";
/** Slightly lifted dark surface. */
export const SURFACE_LIFTED = "#1a1a1a";
/** Near-black panel backgrounds. */
export const SURFACE_PANEL = "#0E0F11";
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
export const DISABLED_ACCENT_SUBTLE = "rgba(125,255,166,0.06)";
/** Drop shadow color for elevated cards. */
export const SHADOW = "#000";
export const OVERLAY_DIM = "rgba(0,0,0,0.45)";
export const OVERLAY_NEAR_FULL = "rgba(0,0,0,0.9)";
export const BG_FADE_MID = "rgba(9,10,11,0.5)";
export const BG_FADE_HEAVY = "rgba(9,10,11,0.88)";
export const BG_TRANSPARENT = "rgba(9,10,11,0)";
export const ACCENT_GRADIENT_START = "rgba(0,255,133,0.14)";
export const ACCENT_GRADIENT_END = "rgba(0,255,133,0.03)";
export const SHARE_GRADIENT_START = "#101215";
export const SHARE_GRADIENT_ACCENT = "#0B100E";
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
export const ACCENT_SELECTED_BG = "rgba(120,255,120,0.08)";
/** Accent borders and fills for chips, selected rows, CTAs. */
export const ACCENT_BORDER = "rgba(0,255,133,0.45)";
export const ACCENT_BORDER_SUBTLE = "rgba(0,255,133,0.22)";
export const ACCENT_BORDER_MUTED = "rgba(0,255,133,0.1)";
export const ACCENT_FILL = "rgba(0,255,133,0.12)";
export const ACCENT_FILL_SUBTLE = "rgba(0,255,133,0.08)";
export const ACCENT_FILL_MUTED = "rgba(0,255,133,0.06)";
export const ACCENT_FILL_FAINT = "rgba(0,255,133,0.04)";
export const ACCENT_FILL_WHISPER = "rgba(0,255,133,0.02)";
export const ACCENT_ICON = "rgba(0,255,133,0.88)";
export const ACCENT_FILL_STRONG = "rgba(0,255,133,0.32)";
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
/** Group list borders — slightly subtler than BORDER. */
export const GROUP_BORDER = "rgba(255,255,255,0.06)";
/** Hairline dividers and faint wells. */
export const SURFACE_FAINT = "rgba(255,255,255,0.03)";
export const SURFACE_SUBTLE = "rgba(255,255,255,0.04)";
export const SURFACE_MUTED = "rgba(255,255,255,0.05)";
export const SURFACE_SOFT = "rgba(255,255,255,0.07)";
export const BORDER_SOFT = "rgba(255,255,255,0.1)";
export const BORDER_LIGHT = "rgba(255,255,255,0.12)";
export const BORDER_HAIRLINE = "rgba(255,255,255,0.14)";
export const DIVIDER = "rgba(255,255,255,0.16)";
export const DIVIDER_STRONG = "rgba(255,255,255,0.22)";
/** Friends tab list/card stroke. */
export const FRIENDS_BORDER = "rgba(255,255,255,0.035)";
/** Search field stroke on Friends tab. */
export const FRIENDS_SEARCH_BORDER = "rgba(255,255,255,0.12)";
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
  fontSize: TYPE_TITLE,
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

/** Accent inline actions (See all, section links). */
export const sectionLinkText: TextStyle = {
  color: ACCENT,
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

/** Main tab headings: Friends, Synq active state — identical scale and weight. */
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
  borderRadius: BUTTON_RADIUS + 8,
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

/** Green outline Add / Add friend CTA (transparent fill). */
export const synqOutlineAddBtn: ViewStyle = {
  alignSelf: "center",
  borderWidth: 1.5,
  borderColor: ACCENT,
  borderRadius: BUTTON_RADIUS,
  paddingVertical: 13,
  paddingHorizontal: 32,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "transparent",
};

export const synqOutlineAddBtnCompact: ViewStyle = {
  borderWidth: 1.5,
  borderColor: ACCENT,
  borderRadius: BUTTON_RADIUS,
  paddingVertical: 9,
  paddingHorizontal: 18,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "transparent",
};

export const synqOutlineAddBtnText: TextStyle = {
  color: ACCENT,
  fontFamily: fonts.heavy,
  fontSize: TYPE_BUTTON,
};

export const synqOutlineAddBtnTextCompact: TextStyle = {
  color: ACCENT,
  fontFamily: fonts.heavy,
  fontSize: TYPE_CAPTION,
  letterSpacing: 0.15,
};

export const synqOutlineAddBtnDisabled: ViewStyle = {
  borderColor: "rgba(255,255,255,0.2)",
  backgroundColor: "transparent",
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
  borderWidth: 1.5,
  borderColor: ACCENT,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "transparent",
};

/** Compact “+ Add” chip (Interests, Open plans, etc.). */
export const synqPlusAddBtn: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  alignSelf: "flex-start",
  borderWidth: 1.5,
  borderColor: ACCENT,
  borderRadius: SYNQ_ADD_ICON_RADIUS,
  paddingRight: 12,
  backgroundColor: "transparent",
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
  fontFamily: fonts.heavy,
  fontSize: TYPE_CAPTION,
  letterSpacing: 0.15,
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
/** AI place suggestions in chat — shown when everyone in the chat has a location. */
export const AI_PLACE_SUGGESTIONS_ENABLED = true;

/** Native builds below this must update (also set Firestore appConfig/global via scripts/set-app-config.mjs). 1.0.4 = build 144. */
export const MINIMUM_NATIVE_BUILD_NUMBER = 144;
export const IOS_APP_STORE_URL =
  "https://apps.apple.com/us/app/synq-see-whos-free/id6757319173";
export const ANDROID_PLAY_STORE_URL =
  "https://play.google.com/store/search?q=Synq&c=apps";

export const aiPrompts = [
    "Let Synq pick the move",
    "Find something fun nearby",
    "Not sure what to do?",
    "Let Synq pick the vibe",
    "Discover something new",
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