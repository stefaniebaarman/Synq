import {
  PROFILE_HEADER_ICON_ROW_HEIGHT,
} from "@/constants/Variables";
import { useTabHeaderLayout } from "@/src/components/ProfileTabHeaderOverlay";
import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * Same vertical slot as Me tab notifications/settings icons (absolute, safe-area aware).
 */
export default function TabHeaderIconRow({ children, style }: Props) {
  const { top } = useTabHeaderLayout();

  return (
    <View
      style={[styles.row, { top }, style]}
      pointerEvents="box-none"
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: "absolute",
    left: 0,
    right: 0,
    height: PROFILE_HEADER_ICON_ROW_HEIGHT,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 3,
  },
});
