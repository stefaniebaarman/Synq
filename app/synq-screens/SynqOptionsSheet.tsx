import { sheetStyles } from "@/constants/sheetStyles";
import SpringBottomSheet from "@/src/components/sheets/SpringBottomSheet";
import { Ionicons } from "@expo/vector-icons";
import { useRef } from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import {
  BG,
  BORDER,
  DESTRUCTIVE,
  RADIUS_MD,
  TYPE_SUBHEAD,
  fonts,
  sheetTitleText,
} from "../../constants/Variables";

type Props = {
  visible: boolean;
  onClose: () => void;
  onEndSynq: () => void;
};

export default function SynqOptionsSheet({
  visible,
  onClose,
  onEndSynq,
}: Props) {
  const pendingActionRef = useRef<(() => void) | null>(null);

  const runAfterClose = (action: () => void) => {
    pendingActionRef.current = action;
    onClose();
  };

  const handleClosed = () => {
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    action?.();
  };

  return (
    <SpringBottomSheet
      visible={visible}
      onClose={onClose}
      onClosed={handleClosed}
      contentStyle={styles.sheetGroup}
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
      <TouchableOpacity
        style={styles.option}
        onPress={() => runAfterClose(onEndSynq)}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="End Synq"
      >
        <Ionicons name="stop-circle-outline" size={22} color={DESTRUCTIVE} />
        <Text style={styles.optionText}>End Synq</Text>
      </TouchableOpacity>
    </SpringBottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetGroup: {
    paddingHorizontal: 12,
    paddingBottom: 34,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 14,
  },
  optionText: {
    color: DESTRUCTIVE,
    fontSize: TYPE_SUBHEAD,
    fontFamily: fonts.medium,
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
