import { StyleSheet } from "react-native";
import {
  BORDER,
  formSectionLabel,
  RADIUS_MD,
  SPACE_1,
  SPACE_3,
  SPACE_4,
  SPACE_5,
  SURFACE,
} from "./Variables";

export const formScreenStyles = StyleSheet.create({
  groupTitle: {
    ...formSectionLabel,
    marginLeft: SPACE_5 + SPACE_1,
    marginBottom: SPACE_3 - 2,
    marginTop: SPACE_3 - 2,
  },
  group: {
    backgroundColor: SURFACE,
    marginHorizontal: SPACE_4 + SPACE_1,
    borderRadius: RADIUS_MD,
    overflow: "hidden",
    marginBottom: SPACE_5 + SPACE_1,
    borderWidth: 1,
    borderColor: BORDER,
  },
});
