import { modalStyles } from "@/constants/modalStyles";
import {
  ACCENT,
  ACCENT_BORDER,
  ACCENT_FILL_SUBTLE,
  DESTRUCTIVE,
  DESTRUCTIVE_BORDER_STRONG,
  DESTRUCTIVE_FILL_SUBTLE,
  MUTED2,
  SYNQ_OUTLINE_CTA_RADIUS,
  TYPE_BUTTON,
  fonts,
  secondaryButtonText,
  synqOutlineAddBtn,
  synqOutlineAddBtnText,
} from "@/constants/Variables";
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
  embedded?: boolean;
  /** Stacked full-width actions (End Synq mockup). */
  stacked?: boolean;
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
  embedded = false,
  stacked = false,
}: Props) {
  if (!visible) return null;

  const card = (
    <View style={modalStyles.overlay}>
      <View style={[modalStyles.cardCompact, stacked && styles.stackedCard]}>
        {title ? (
          <Text style={[modalStyles.title, stacked && styles.stackedTitle]}>
            {title}
          </Text>
        ) : null}

        {message.trim().length > 0 ? (
          <Text style={[modalStyles.body, stacked && styles.stackedBody]}>
            {message}
          </Text>
        ) : null}

        {stacked ? (
          <View style={styles.stackedActions}>
            <TouchableOpacity
              onPress={onConfirm}
              disabled={confirmDisabled}
              style={[
                synqOutlineAddBtn,
                destructive && styles.stackedDestructive,
                confirmDisabled && styles.confirmBtnDisabled,
              ]}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  synqOutlineAddBtnText,
                  destructive && styles.stackedDestructiveText,
                ]}
              >
                {confirmText}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onCancel}
              style={styles.stackedCancel}
              activeOpacity={0.8}
            >
              <Text style={styles.stackedCancelText}>{cancelText}</Text>
            </TouchableOpacity>
          </View>
        ) : (
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
                  synqOutlineAddBtnText,
                  destructive && styles.destructiveText,
                ]}
              >
                {confirmText}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );

  if (embedded) {
    return <View style={styles.embeddedRoot}>{card}</View>;
  }

  return (
    <Modal visible transparent animationType="fade">
      {card}
    </Modal>
  );
}

const styles = StyleSheet.create({
  embeddedRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginRight: 10,
  },
  confirmBtn: {
    backgroundColor: ACCENT_FILL_SUBTLE,
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
    borderRadius: SYNQ_OUTLINE_CTA_RADIUS,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtnDisabled: {
    opacity: 0.45,
  },
  destructiveBtn: {
    backgroundColor: DESTRUCTIVE_FILL_SUBTLE,
    borderWidth: 1,
    borderColor: DESTRUCTIVE_BORDER_STRONG,
    borderRadius: SYNQ_OUTLINE_CTA_RADIUS,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  destructiveText: {
    color: DESTRUCTIVE,
    fontFamily: fonts.medium,
    fontSize: TYPE_BUTTON,
    letterSpacing: 0.1,
  },
  stackedCard: {
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 22,
    borderRadius: 22,
  },
  stackedTitle: {
    textAlign: "center",
    marginBottom: 8,
  },
  stackedBody: {
    textAlign: "center",
    marginBottom: 22,
    color: MUTED2,
  },
  stackedActions: {
    gap: 12,
    alignItems: "center",
  },
  stackedDestructive: {
    backgroundColor: DESTRUCTIVE_FILL_SUBTLE,
    borderWidth: 1,
    borderColor: DESTRUCTIVE_BORDER_STRONG,
  },
  stackedDestructiveText: {
    color: DESTRUCTIVE,
    letterSpacing: 0.1,
    textTransform: "none",
  },
  stackedCancel: {
    alignItems: "center",
    paddingVertical: 8,
  },
  stackedCancelText: {
    ...secondaryButtonText,
  },
});
