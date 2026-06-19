import { navigationCloseBtn } from "@/constants/Variables";
import React from "react";
import {
  TouchableOpacity,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import CloseIcon from "./CloseIcon";

type Props = {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  activeOpacity?: number;
};

export default function CloseButton({
  onPress,
  style,
  accessibilityLabel = "Close",
  activeOpacity = 0.7,
}: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[navigationCloseBtn, style]}
      activeOpacity={activeOpacity}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <CloseIcon />
    </TouchableOpacity>
  );
}
