import SynqAudiencePicker from "@/src/components/synq/SynqAudiencePicker";
import SpringBottomSheet from "@/src/components/sheets/SpringBottomSheet";
import { sheetStyles } from "@/constants/sheetStyles";
import {
  ACCENT,
  BUTTON_RADIUS,
  GROUP_BORDER,
  SHEET_SURFACE,
  SPACE_3,
  SPACE_4,
  SPACE_5,
  SPACE_6,
  primaryButtonText,
} from "@/constants/Variables";
import type { FriendGroup } from "@/src/lib/friendGroups";
import type { SynqAudienceSelection } from "@/src/lib/synqBroadcast";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  visible: boolean;
  groups: FriendGroup[];
  selection: SynqAudienceSelection;
  onChangeSelection: (next: SynqAudienceSelection) => void;
  onClose: () => void;
};

export default function SynqAudienceSheet({
  visible,
  groups,
  selection,
  onChangeSelection,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <SpringBottomSheet
      visible={visible}
      onClose={onClose}
      contentStyle={[styles.sheetGroup, { paddingBottom: insets.bottom + SPACE_4 }]}
      cardStyle={sheetStyles.sheetCard}
    >
      <Text style={[sheetStyles.sheetTitle, styles.sheetTitlePad]}>
        Share with
      </Text>
      <View style={styles.pickerSection}>
        <SynqAudiencePicker
          groups={groups}
          selection={selection}
          onChangeSelection={onChangeSelection}
        />
      </View>
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.doneBtn}
          onPress={onClose}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel="Done"
        >
          <Text style={styles.doneText}>Done</Text>
        </TouchableOpacity>
      </View>
    </SpringBottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetGroup: {
    paddingHorizontal: SPACE_5,
  },
  sheetTitlePad: {
    paddingTop: SPACE_3,
    paddingBottom: SPACE_4,
    paddingHorizontal: SPACE_4,
  },
  pickerSection: {
    paddingBottom: SPACE_4,
  },
  footer: {
    alignItems: "center",
    paddingHorizontal: SPACE_4,
    paddingTop: SPACE_6,
    paddingBottom: SPACE_5,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: GROUP_BORDER,
    backgroundColor: SHEET_SURFACE,
  },
  doneBtn: {
    alignSelf: "center",
    backgroundColor: ACCENT,
    borderRadius: BUTTON_RADIUS,
    minHeight: 48,
    minWidth: 128,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACE_5,
    paddingVertical: 12,
  },
  doneText: primaryButtonText,
});
