import { modalStyles } from "@/constants/modalStyles";
import {
  ACCENT,
  BUTTON_RADIUS,
  DESTRUCTIVE,
  DESTRUCTIVE_FILL,
  TYPE_LEAD,
  primaryButtonText,
} from "@/constants/Variables";
import React from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type Props = {
  visible: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
  confirmDisabled?: boolean;
};

export default function ConfirmModal({
  visible,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  destructive = false,
  confirmDisabled = false,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={modalStyles.overlay}>
        <View style={modalStyles.cardCompact}>
          {title ? <Text style={modalStyles.title}>{title}</Text> : null}

          {message.trim().length > 0 ? (
            <Text style={modalStyles.body}>{message}</Text>
          ) : null}

          <View style={styles.actions}>
            <TouchableOpacity
              onPress={onCancel}
              style={styles.cancelBtn}
              activeOpacity={0.8}
            >
              <Text style={modalStyles.secondaryBtnText}>{cancelText}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onConfirm}
              disabled={confirmDisabled}
              style={[
                styles.confirmBtn,
                destructive && styles.destructiveBtn,
                confirmDisabled && styles.confirmBtnDisabled,
              ]}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  primaryButtonText,
                  styles.confirmTextSize,
                  destructive && styles.destructiveText,
                ]}
              >
                {confirmText}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginRight: 10,
  },
  confirmBtn: {
    backgroundColor: ACCENT,
    borderRadius: BUTTON_RADIUS,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  confirmBtnDisabled: {
    opacity: 0.45,
  },
  confirmTextSize: {
    fontSize: TYPE_LEAD,
  },
  destructiveBtn: {
    backgroundColor: DESTRUCTIVE_FILL,
    borderWidth: 1,
    borderColor: DESTRUCTIVE,
  },
  destructiveText: {
    color: DESTRUCTIVE,
  },
});
