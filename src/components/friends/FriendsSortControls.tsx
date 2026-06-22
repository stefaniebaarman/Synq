import {
  ACCENT,
  BG,
  BORDER_SOFT,
  BUTTON_RADIUS,
  GROUP_BORDER,
  MUTED,
  MUTED2,
  MUTED3,
  RADIUS_LG,
  SURFACE,
  TEXT,
  TYPE_CAPTION,
  TYPE_SUBHEAD,
  fonts,
} from "@/constants/Variables";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

export type FriendsSortMode = "alphabetical" | "distance";

export const FRIENDS_SORT_LABELS: Record<FriendsSortMode, string> = {
  alphabetical: "Alphabetical",
  distance: "Distance",
};

const SORT_SURFACE = "#0A0B0D";
const SORT_BORDER = "rgba(255,255,255,0.12)";
const SORT_MENU_FADE_MS = 280;

export function FriendsSortTrigger({
  sortMode,
  onPress,
}: {
  sortMode: FriendsSortMode;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.sortBarBtn}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityLabel={`Sort by, ${FRIENDS_SORT_LABELS[sortMode]}`}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    >
      <Text style={styles.sortBarLabel}>Sort by</Text>
      <Ionicons name="chevron-down" size={12} color={MUTED2} style={styles.sortBarChevron} />
    </TouchableOpacity>
  );
}

export function FriendsSortMenu({
  visible,
  sortMode,
  onSelect,
  onClose,
}: {
  visible: boolean;
  sortMode: FriendsSortMode;
  onSelect: (mode: FriendsSortMode) => void;
  onClose: () => void;
}) {
  const reduced = useReducedMotion();
  const [modalVisible, setModalVisible] = useState(false);
  const opacity = useSharedValue(0);

  const options: { mode: FriendsSortMode; label: string }[] = [
    { mode: "alphabetical", label: "Alphabetical" },
    { mode: "distance", label: "Distance" },
  ];

  const finishClose = useCallback(() => {
    setModalVisible(false);
    onClose();
  }, [onClose]);

  const dismiss = useCallback(() => {
    if (reduced) {
      finishClose();
      return;
    }
    opacity.value = withTiming(
      0,
      { duration: SORT_MENU_FADE_MS, easing: Easing.in(Easing.cubic) },
      (done) => {
        if (done) runOnJS(finishClose)();
      }
    );
  }, [reduced, finishClose, opacity]);

  useEffect(() => {
    if (!visible) return;
    setModalVisible(true);
    opacity.value = reduced
      ? 1
      : withTiming(1, { duration: SORT_MENU_FADE_MS, easing: Easing.out(Easing.cubic) });
  }, [visible, reduced, opacity]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!modalVisible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={dismiss}>
      <Animated.View style={[styles.sortMenuOverlay, overlayStyle]}>
        <Pressable
          style={styles.sortMenuBackdrop}
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss sort menu"
        />
        <Pressable style={styles.sortMenuSheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.sortMenuHandle} />
          <Text style={styles.sortMenuTitle}>Sort by</Text>
          {options.map((option, index) => {
            const selected = sortMode === option.mode;
            return (
              <View key={option.mode}>
                {index > 0 ? <View style={styles.sortMenuSeparator} /> : null}
                <TouchableOpacity
                  style={styles.sortMenuOption}
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onSelect(option.mode);
                    dismiss();
                  }}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.sortMenuOptionLabel,
                      selected && styles.sortMenuOptionLabelSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {selected ? (
                    <Ionicons name="checkmark" size={18} color={ACCENT} />
                  ) : null}
                </TouchableOpacity>
              </View>
            );
          })}
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sortBarBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 32,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: BUTTON_RADIUS,
    backgroundColor: SORT_SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SORT_BORDER,
  },
  sortBarLabel: {
    color: MUTED,
    fontSize: TYPE_CAPTION,
    fontFamily: fonts.medium,
    letterSpacing: 0.22,
  },
  sortBarChevron: {
    marginTop: 1,
    opacity: 0.9,
  },
  sortMenuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.78)",
    justifyContent: "flex-end",
  },
  sortMenuBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sortMenuSheet: {
    backgroundColor: BG,
    borderTopLeftRadius: RADIUS_LG,
    borderTopRightRadius: RADIUS_LG,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: GROUP_BORDER,
    paddingTop: 10,
    paddingBottom: 44,
  },
  sortMenuHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: BORDER_SOFT,
    alignSelf: "center",
    marginBottom: 18,
  },
  sortMenuTitle: {
    color: MUTED3,
    fontSize: TYPE_CAPTION,
    fontFamily: fonts.book,
    letterSpacing: 0.15,
    paddingHorizontal: 20,
    paddingBottom: 10,
    includeFontPadding: false,
  },
  sortMenuSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: SURFACE,
    marginLeft: 20,
  },
  sortMenuOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  sortMenuOptionLabel: {
    flex: 1,
    color: MUTED2,
    fontSize: TYPE_SUBHEAD,
    fontFamily: fonts.book,
    letterSpacing: 0.02,
    paddingRight: 12,
  },
  sortMenuOptionLabelSelected: {
    color: TEXT,
    fontFamily: fonts.medium,
  },
});
