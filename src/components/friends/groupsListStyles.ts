import {
  ACCENT,
  ACCENT_BORDER,
  ACCENT_FILL_SUBTLE,
  BORDER_SUBTLE_HEX,
  RADIUS_LG,
  SURFACE_ELEVATED,
  SURFACE_INPUT,
  SURFACE_RAISED,
  SYNQ_OUTLINE_CTA_RADIUS,
  TYPE_MICRO,
  cardMetaText,
  cardTitleText,
  detailSectionTitle,
  fonts,
  listRowTitleText,
  listSectionTitle,
  searchPlaceholderText,
  synqOutlineAddBtnTextCompact,
  RADIUS_SM,
} from "@/constants/Variables";
import { StyleSheet, Platform } from "react-native";

/** List/card wells — interests pill gray on Android, raised card on iOS. */
export const GROUP_SURFACE = Platform.OS === "android" ? SURFACE_INPUT : SURFACE_RAISED;
export { GROUP_BORDER } from "@/constants/Variables";
export const GROUP_ROW_INSET = 72;
/** Solid gray card stroke — Android tints semi-transparent borders/fills green on dark UI. */
const GROUP_CARD_BORDER = BORDER_SUBTLE_HEX;
const GROUP_CARD_BORDER_WIDTH = Platform.OS === "android" ? 1 : StyleSheet.hairlineWidth;
/** Neutral list chips/buttons on cards (Join, section +). */
const GROUP_NEUTRAL_BTN = {
  borderColor: BORDER_SUBTLE_HEX,
  backgroundColor: SURFACE_ELEVATED,
} as const;

export const groupsPageStyles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingTop: 2,
    gap: 28,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    marginBottom: 2,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitleStart: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  sectionTitle: {
    ...listSectionTitle,
    marginTop: 0,
  },
  sectionAddBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    borderColor: ACCENT_BORDER,
    backgroundColor: ACCENT_FILL_SUBTLE,
  },
  sectionSubtitle: {
    ...searchPlaceholderText,
    lineHeight: 19,
    paddingRight: 8,
  },
  infoBtn: {
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
  },
  circleCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: GROUP_SURFACE,
    borderRadius: RADIUS_LG,
    borderWidth: GROUP_CARD_BORDER_WIDTH,
    borderColor: GROUP_CARD_BORDER,
    overflow: "hidden",
  },
  circleCardMain: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  circleCardTitle: {
    ...cardTitleText,
    marginBottom: 2,
  },
  circleCardMeta: {
    ...cardMetaText,
  },
  browseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: GROUP_SURFACE,
    borderRadius: RADIUS_LG,
    borderWidth: GROUP_CARD_BORDER_WIDTH,
    borderColor: GROUP_CARD_BORDER,
    overflow: "hidden",
  },
  browseRowIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS_SM,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: SURFACE_ELEVATED,
  },
  browseRowTitle: {
    ...listRowTitleText,
    flex: 1,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 42,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: GROUP_SURFACE,
    borderWidth: GROUP_CARD_BORDER_WIDTH,
    borderColor: BORDER_SUBTLE_HEX,
  },
  searchBarPlaceholder: {
    ...searchPlaceholderText,
    flex: 1,
  },
  subsectionTitle: {
    ...detailSectionTitle,
    marginTop: 4,
  },
  discoverScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  discoverCard: {
    width: 168,
    padding: 14,
    marginRight: 12,
    backgroundColor: GROUP_SURFACE,
    borderRadius: RADIUS_LG,
    borderWidth: GROUP_CARD_BORDER_WIDTH,
    borderColor: GROUP_CARD_BORDER,
  },
  discoverCardIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS_SM,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: SURFACE_ELEVATED,
    marginBottom: 12,
  },
  discoverCardCover: {
    width: 44,
    height: 44,
    borderRadius: RADIUS_SM,
    marginBottom: 12,
    backgroundColor: SURFACE_ELEVATED,
  },
  discoverCardTitle: {
    ...cardTitleText,
    marginBottom: 4,
  },
  discoverCardTag: {
    alignSelf: "flex-start",
    fontFamily: fonts.medium,
    fontSize: TYPE_MICRO,
    color: ACCENT,
    letterSpacing: 0.3,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  discoverCardMeta: {
    ...cardMetaText,
    marginBottom: 12,
  },
  joinBtn: {
    alignSelf: "flex-start",
    minWidth: 58,
    borderWidth: 1,
    borderRadius: SYNQ_OUTLINE_CTA_RADIUS,
    paddingVertical: 7,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    ...GROUP_NEUTRAL_BTN,
  },
  joinBtnText: {
    ...synqOutlineAddBtnTextCompact,
  },
  joinBtnDisabled: {
    opacity: 0.45,
  },
  communityListSurface: {
    backgroundColor: GROUP_SURFACE,
    borderRadius: RADIUS_LG,
    borderWidth: GROUP_CARD_BORDER_WIDTH,
    borderColor: GROUP_CARD_BORDER,
    overflow: "hidden",
  },
  communityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 13,
    paddingHorizontal: 16,
    backgroundColor: GROUP_SURFACE,
  },
  communityRowMainTouchable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minWidth: 0,
  },
  communityRowMain: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  communityRowTitle: {
    ...listRowTitleText,
    marginBottom: 2,
  },
  communityRowMeta: {
    ...cardMetaText,
  },
  rowSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: GROUP_CARD_BORDER,
    marginLeft: GROUP_ROW_INSET,
  },
  loadingInline: {
    paddingVertical: 24,
    alignItems: "center",
  },
});
