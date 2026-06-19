import { modalStyles } from "@/constants/modalStyles";
import { primaryButtonText } from "@/constants/Variables";
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
  buttonText?: string;
  onClose: () => void;
};

export default function AlertModal({
  visible,
  title,
  message,
  buttonText = "OK",
  onClose,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={modalStyles.overlay}>
        <View style={[modalStyles.card, styles.cardCentered]}>
          {title && <Text style={[modalStyles.title, styles.titleCentered]}>{title}</Text>}

          <Text style={[modalStyles.body, styles.messageCentered]}>{message}</Text>

          <TouchableOpacity
            style={modalStyles.primaryBtn}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={primaryButtonText}>{buttonText}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  cardCentered: {
    alignItems: "center",
  },
  titleCentered: {
    textAlign: "center",
  },
  messageCentered: {
    textAlign: "center",
  },
});
