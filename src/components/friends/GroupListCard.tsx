import { ANDROID_RIPPLE } from "@/constants/Variables";
import { groupsPageStyles } from "@/src/components/friends/groupsListStyles";
import React from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";

export const GROUP_LIST_ANDROID_RIPPLE = ANDROID_RIPPLE ?? {
  color: "#1A1B1D",
};

type Props = {
  onPress: () => void;
  onLongPress?: () => void;
  delayLongPress?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel: string;
  accessibilityHint?: string;
  children: React.ReactNode;
};

/** List row card with neutral Android ripple (avoids theme accent green flash). */
export default function GroupListCard({
  onPress,
  onLongPress,
  delayLongPress,
  style,
  accessibilityLabel,
  accessibilityHint,
  children,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      android_ripple={
        Platform.OS === "android" ? GROUP_LIST_ANDROID_RIPPLE : undefined
      }
      style={({ pressed }) => [
        groupsPageStyles.circleCard,
        style,
        pressed && Platform.OS === "ios" && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.88,
  },
});
