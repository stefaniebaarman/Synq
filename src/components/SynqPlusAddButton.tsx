import {
  SYNQ_PLUS_ADD_GLYPH_SIZE,
  synqPlusAddBtn,
  synqPlusAddBtnIcon,
  synqPlusAddBtnText,
} from "@/constants/Variables";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

type Props = {
  onPress: () => void;
  accessibilityLabel: string;
  label?: string;
  iconName?: React.ComponentProps<typeof Ionicons>["name"];
  style?: StyleProp<ViewStyle>;
  activeOpacity?: number;
  disabled?: boolean;
};

export default function SynqPlusAddButton({
  onPress,
  accessibilityLabel,
  label = "Add",
  iconName = "add",
  style,
  activeOpacity = 0.85,
  disabled = false,
}: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[synqPlusAddBtn, disabled && { opacity: 0.45 }, style]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      activeOpacity={activeOpacity}
      disabled={disabled}
    >
      <View style={synqPlusAddBtnIcon}>
        <Ionicons
          name={iconName}
          size={SYNQ_PLUS_ADD_GLYPH_SIZE}
          color="rgba(0,255,133,0.88)"
        />
      </View>
      <Text style={synqPlusAddBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}
