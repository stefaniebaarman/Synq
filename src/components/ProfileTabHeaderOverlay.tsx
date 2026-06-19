import {
  getTabHeaderLayout,
  HEADER_BLACK,
  PROFILE_HEADER_FADE_GRADIENT,
  PROFILE_HEADER_FADE_LOCATIONS,
} from "@/constants/Variables";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  /** Icon row rendered above scroll content (notifications, settings, etc.). */
  children?: React.ReactNode;
  /** Extra height below icon row before fade ends (default from layout helper). */
  gradientHeight?: number;
  /** Shorter fade when the tab uses an in-flow title (Friends, Synq active). */
  variant?: "icons" | "title";
  /** Parent already applied top safe-area padding (embedded friend profile). */
  embedded?: boolean;
};

/**
 * Floating black status-bar fill + gradient fade for tab screens (Me, Friends, Synq active).
 */
export default function ProfileTabHeaderOverlay({
  children,
  gradientHeight,
  variant = "icons",
  embedded = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const layout = getTabHeaderLayout(embedded ? 0 : insets.top);
  const height =
    gradientHeight ??
    (embedded
      ? 56
      : variant === "title"
        ? layout.titleGradientHeight
        : layout.gradientHeight);

  return (
    <>
      {!embedded ? (
        <View
          pointerEvents="none"
          style={[styles.solidBar, { height: insets.top }]}
        />
      ) : null}
      <LinearGradient
        pointerEvents="none"
        colors={[...PROFILE_HEADER_FADE_GRADIENT]}
        locations={[...PROFILE_HEADER_FADE_LOCATIONS]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[styles.gradient, { height }]}
      />
      {children ? (
        <View
          style={[styles.iconRow, { top: embedded ? 4 : layout.top }]}
          pointerEvents="box-none"
        >
          {children}
        </View>
      ) : null}
    </>
  );
}

export function useTabHeaderLayout(opts?: { embedded?: boolean }) {
  const insets = useSafeAreaInsets();
  const embedded = opts?.embedded ?? false;
  const layout = getTabHeaderLayout(embedded ? 0 : insets.top);
  return {
    ...layout,
    contentPaddingTop: embedded ? 52 : layout.contentPaddingTop,
  };
}

const styles = StyleSheet.create({
  solidBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: HEADER_BLACK,
    zIndex: 2,
  },
  gradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
  },
  iconRow: {
    position: "absolute",
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    zIndex: 3,
  },
});
