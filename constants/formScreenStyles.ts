import { StyleSheet } from "react-native";
import {
  GROUP_BORDER,
  RADIUS_LG,
  formSectionLabel,
  SPACE_1,
  SPACE_3,
  SPACE_4,
  SPACE_5,
  SURFACE_RAISED,
} from "./Variables";

export const formScreenStyles = StyleSheet.create({
  groupTitle: {
    ...formSectionLabel,
    marginLeft: SPACE_5 + SPACE_1,
    marginBottom: SPACE_3 - 2,
    marginTop: SPACE_3 - 2,
  },
  group: {
    backgroundColor: SURFACE_RAISED,
    marginHorizontal: SPACE_4 + SPACE_1,
    borderRadius: RADIUS_LG,
    overflow: "hidden",
    marginBottom: SPACE_5 + SPACE_1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GROUP_BORDER,
  },
});
