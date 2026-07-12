import SynqAudiencePicker from "@/src/components/synq/SynqAudiencePicker";
import { SHEET_ANIMATION, sheetStyles } from "@/constants/sheetStyles";
import {
  ACCENT,
  BUTTON_RADIUS,
  GROUP_BORDER,
  SHEET_OVERLAY,
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
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
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
    <Modal
      visible={visible}
      transparent
      animationType={SHEET_ANIMATION}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={sheetStyles.backdrop}
          onPress={onClose}
          accessibilityLabel="Close"
        />
        <View style={[styles.sheetGroup, { paddingBottom: insets.bottom + SPACE_4 }]}>
          <View style={sheetStyles.sheetCard}>
            <View style={sheetStyles.grabberWrap}>
              <View style={sheetStyles.grabber} />
            </View>
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
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: SHEET_OVERLAY,
  },
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
