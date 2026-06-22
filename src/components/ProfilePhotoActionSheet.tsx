import {
  BORDER,
  BUTTON_RADIUS,
  DESTRUCTIVE,
  SHEET_OVERLAY,
  SHEET_SURFACE,
  TEXT,
  TYPE_SUBHEAD,
  fonts,
  sheetTitleText,
} from "@/constants/Variables";
import { Ionicons } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
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

  if (!visible) return null;

  return (
    <View style={styles.portal} pointerEvents="box-none">
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityLabel="Close menu"
      />
      <View
        style={[
          styles.sheetGroup,
          { paddingBottom: tabBarHeight + Math.max(insets.bottom, 12) + 8 },
        ]}
        pointerEvents="box-none"
      >
        <View style={styles.sheet}>
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
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  portal: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
    justifyContent: "flex-end",
    backgroundColor: SHEET_OVERLAY,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  sheetGroup: {
    paddingHorizontal: 12,
    zIndex: 1,
  },
  sheet: {
    backgroundColor: SHEET_SURFACE,
    borderRadius: BUTTON_RADIUS + 4,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 14,
  },
  optionText: {
    color: TEXT,
    fontSize: TYPE_SUBHEAD,
    fontFamily: fonts.medium,
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
