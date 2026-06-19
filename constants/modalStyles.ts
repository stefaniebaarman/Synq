import { StyleSheet } from "react-native";
import {
  ACCENT,
  BG,
  BORDER,
  BUTTON_RADIUS,
  DESTRUCTIVE,
  MODAL_OVERLAY,
  MODAL_RADIUS,
  MUTED2,
  ON_ACCENT_TEXT,
  SPACE_2,
  SPACE_4,
  SPACE_5,
  TEXT,
  ctaButtonText,
  fonts,
  modalBodyText,
  modalTitleText,
  primaryButtonText,
  TYPE_LEAD,
} from "./Variables";

export const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: MODAL_OVERLAY,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACE_5,
  },
  card: {
    width: "100%",
    backgroundColor: BG,
    borderRadius: MODAL_RADIUS,
    padding: 22,
    borderWidth: 1,
    borderColor: BORDER,
  },
  cardCompact: {
    width: "100%",
    backgroundColor: BG,
    borderRadius: BUTTON_RADIUS,
    padding: 22,
    borderWidth: 1,
    borderColor: BORDER,
  },
  title: {
    ...modalTitleText,
    marginBottom: SPACE_2,
  },
  titleCompact: {
    color: TEXT,
    fontSize: TYPE_LEAD,
    fontFamily: fonts.heavy,
    marginBottom: SPACE_2,
  },
  body: {
    ...modalBodyText,
    marginBottom: SPACE_5,
  },
  primaryBtn: {
    backgroundColor: ACCENT,
    borderRadius: BUTTON_RADIUS,
    paddingVertical: 14,
    paddingHorizontal: SPACE_4,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: primaryButtonText,
  ctaBtnText: ctaButtonText,
  secondaryBtnText: {
    color: MUTED2,
    fontSize: TYPE_LEAD,
    fontFamily: fonts.medium,
  },
  destructiveBtn: {
    backgroundColor: DESTRUCTIVE,
  },
  destructiveText: {
    color: TEXT,
  },
});
