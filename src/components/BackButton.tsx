import { navigationBackBtn } from "@/constants/Variables";
import React from "react";
import {
  TouchableOpacity,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import BackIcon from "./BackIcon";

type Props = {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  activeOpacity?: number;
};

export default function BackButton({
  onPress,
  style,
  accessibilityLabel = "Go back",
  activeOpacity = 0.7,
}: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[navigationBackBtn, style]}
      activeOpacity={activeOpacity}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <BackIcon />
    </TouchableOpacity>
  );
}
