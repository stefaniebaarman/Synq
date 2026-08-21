import { sheetStyles } from "@/constants/sheetStyles";
import SpringBottomSheet from "@/src/components/sheets/SpringBottomSheet";
import {
  BG,
  BORDER,
  DESTRUCTIVE,
  RADIUS_MD,
  TEXT,
  listRowTitleText,
  sheetTitleText,
} from "@/constants/Variables";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  visible: boolean;
  chatTitle: string;
  canCombine: boolean;
  onClose: () => void;
  onCombine: () => void;
  onDelete: () => void;
};

export default function ChatInboxActionSheet({
  visible,
  chatTitle,
  canCombine,
  onClose,
  onCombine,
  onDelete,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <SpringBottomSheet
      visible={visible}
      onClose={onClose}
      presentation="embedded"
      contentStyle={[
        styles.sheetGroup,
        { paddingBottom: Math.max(insets.bottom, 12) + 8 },
      ]}
      header={
        <Text style={sheetStyles.sheetKicker} numberOfLines={1}>
          {chatTitle}
        </Text>
      }
      cardStyle={sheetStyles.sheetCard}
      footer={
        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={onClose}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      }
    >
      {canCombine ? (
        <TouchableOpacity
          style={styles.option}
          onPress={onCombine}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Combine with another chat"
        >
          <Ionicons name="people-outline" size={22} color={TEXT} />
          <Text style={styles.optionText}>Combine with another chat</Text>
        </TouchableOpacity>
      ) : null}
      {canCombine ? <View style={styles.divider} /> : null}
      <TouchableOpacity
        style={styles.option}
        onPress={onDelete}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="Delete conversation"
      >
        <Ionicons name="trash-outline" size={22} color={DESTRUCTIVE} />
        <Text style={[styles.optionText, styles.destructiveText]}>
          Delete chat
        </Text>
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
  cancelBtn: {
    marginTop: 10,
    backgroundColor: BG,
    borderRadius: RADIUS_MD,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 16,
    alignItems: "center",
  },
  cancelText: sheetTitleText,
});
