import { StyleSheet } from "react-native";
import {
  BG,
  BORDER,
  MODAL_RADIUS,
  RADIUS_MD,
  MUTED3,
  SHEET_OVERLAY,
  SHEET_SURFACE,
  SPACE_2,
  SPACE_3,
  SPACE_4,
  SPACE_5,
  modalBodyText,
  modalTitleText,
  primaryButtonText,
  secondaryButtonText,
  sheetHeaderTitleText,
  sheetKickerText,
  sheetTitleText,
  TYPE_LEAD,
  fonts,
  MUTED2,
  TEXT,
} from "./Variables";

/** Bottom sheets rise; centered alerts/dialogs stay fade. */
export const SHEET_ANIMATION = "slide" as const;
export const DIALOG_ANIMATION = "fade" as const;

export const sheetStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: SHEET_OVERLAY,
    justifyContent: "flex-end",
  },
  overlayCentered: {
    flex: 1,
    backgroundColor: SHEET_OVERLAY,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACE_5,
  },
  /** Full-bleed backdrop press target behind a bottom sheet. */
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: SHEET_SURFACE,
    borderTopLeftRadius: MODAL_RADIUS,
    borderTopRightRadius: MODAL_RADIUS,
    padding: SPACE_5,
    paddingBottom: 36,
    borderWidth: 1,
    borderColor: BORDER,
  },
  sheetAlt: {
    backgroundColor: SHEET_SURFACE,
    borderTopLeftRadius: MODAL_RADIUS,
    borderTopRightRadius: MODAL_RADIUS,
    padding: SPACE_5,
    paddingBottom: 36,
    borderWidth: 1,
    borderColor: BORDER,
  },
  /** Rounded floating sheet card (Synq options / audience). */
  sheetCard: {
    backgroundColor: SHEET_SURFACE,
    borderRadius: RADIUS_MD,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
  },
  grabberWrap: {
    alignItems: "center",
    paddingTop: SPACE_3,
    paddingBottom: SPACE_2,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 99,
    backgroundColor: MUTED3,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: MODAL_RADIUS,
    padding: 22,
  },
  title: {
    ...modalTitleText,
    marginBottom: 6,
  },
  sheetTitle: {
    ...sheetTitleText,
    textAlign: "center",
  },
  sheetHeaderTitle: sheetHeaderTitleText,
  sheetKicker: {
    ...sheetKickerText,
    marginBottom: 10,
    paddingHorizontal: SPACE_5,
  },
  body: {
    ...modalBodyText,
    lineHeight: 22,
  },
  bodyCompact: {
    color: MUTED2,
    fontSize: TYPE_LEAD,
    fontFamily: fonts.book,
    lineHeight: 20,
  },
  secondaryBtnText: secondaryButtonText,
  primaryBtnText: primaryButtonText,
  destructiveText: {
    color: TEXT,
    fontFamily: fonts.heavy,
    fontSize: TYPE_LEAD,
  },
});
