import { sheetStyles } from "@/constants/sheetStyles";
import SpringBottomSheet from "@/src/components/sheets/SpringBottomSheet";
import {
  BORDER,
  DESTRUCTIVE,
  TEXT,
  listRowTitleText,
  sheetTitleText,
} from "@/constants/Variables";
import { Ionicons } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  visible: boolean;
  showRemove: boolean;
  onClose: () => void;
  onUpload: () => void | Promise<void>;
  onRemove: () => void | Promise<void>;
};

export default function ProfilePhotoActionSheet({
  visible,
  showRemove,
  onClose,
  onUpload,
  onRemove,
}: Props) {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  return (
    <SpringBottomSheet
      visible={visible}
      onClose={onClose}
      presentation="embedded"
      contentStyle={[
        styles.sheetGroup,
        { paddingBottom: tabBarHeight + Math.max(insets.bottom, 12) + 8 },
      ]}
      cardStyle={sheetStyles.sheetCard}
    >
      <TouchableOpacity
        style={styles.option}
        onPress={() => void onUpload()}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="Upload photo"
      >
        <Ionicons name="image-outline" size={22} color={TEXT} />
        <Text style={styles.optionText}>Upload photo</Text>
      </TouchableOpacity>
      {showRemove ? (
        <>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.option}
            onPress={() => void onRemove()}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Remove photo"
          >
            <Ionicons name="trash-outline" size={22} color={DESTRUCTIVE} />
            <Text style={[styles.optionText, styles.destructiveText]}>
              Remove photo
            </Text>
          </TouchableOpacity>
        </>
      ) : null}
      <View style={styles.dividerFull} />
      <TouchableOpacity
        style={styles.cancelOption}
        onPress={onClose}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="Cancel"
      >
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </SpringBottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetGroup: {
    paddingHorizontal: 12,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 14,
  },
  optionText: {
    ...listRowTitleText,
  },
  destructiveText: {
    color: DESTRUCTIVE,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER,
    marginLeft: 54,
  },
  dividerFull: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER,
  },
  cancelOption: {
    paddingVertical: 16,
    alignItems: "center",
  },
  cancelText: sheetTitleText,
});
