import { formScreenStyles } from "@/constants/formScreenStyles";
import {
  ACCENT,
  GROUP_BORDER,
  RADIUS_LG,
  SPACE_1,
  SPACE_3,
  SPACE_4,
  SPACE_5,
  SPACE_6,
  SURFACE_RAISED,
  TEXT,
  TEXT_MUTED_HEX,
  TYPE_BODY,
  TYPE_CTA,
  TYPE_LEAD,
  fonts
} from "@/constants/Variables";
import { StyleSheet } from "react-native";

export const legalDocumentStyles = StyleSheet.create({
  scrollContent: {
    paddingBottom: SPACE_6 + SPACE_1,
    paddingTop: SPACE_3,
  },
  section: { marginTop: 2 },
  sectionTitle: formScreenStyles.groupTitle,
  card: {
    backgroundColor: SURFACE_RAISED,
    marginHorizontal: SPACE_4 + SPACE_1,
    borderRadius: RADIUS_LG,
    padding: SPACE_4 + 2,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GROUP_BORDER,
  },
  text: {
    color: TEXT,
    fontFamily: fonts.medium,
    fontSize: TYPE_BODY,
    lineHeight: 24,
    marginBottom: 10,
  },
  bold: { fontFamily: fonts.heavy, color: TEXT },
  bullets: { marginTop: 6 },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  bulletDot: { color: ACCENT, marginRight: 10, fontSize: TYPE_CTA, lineHeight: 22 },
  bulletText: {
    color: TEXT,
    fontFamily: fonts.medium,
    fontSize: TYPE_BODY,
    lineHeight: 24,
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  lastUpdated: {
    color: TEXT_MUTED_HEX,
    fontFamily: fonts.medium,
    fontSize: TYPE_LEAD,
    lineHeight: 18,
    marginTop: 24,
    marginHorizontal: SPACE_5 + 1,
  },
  footerSpace: { height: SPACE_5 },
});
