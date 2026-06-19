import { HEADER_ICON_SIZE, TEXT } from "@/constants/Variables";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

type Props = {
  name: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  badge?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  size?: number;
};

export default function HeaderIconButton({
  name,
  onPress,
  accessibilityLabel,
  badge,
  style,
  size = HEADER_ICON_SIZE,
}: Props) {
  return (
    <Pressable
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={[styles.container, style]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={styles.inner}>
        <Ionicons name={name} size={size} color={TEXT} />
        {badge}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  inner: {
    position: "relative",
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
});
