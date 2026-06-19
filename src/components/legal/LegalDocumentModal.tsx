import {
  BG,
  BORDER,
  MODAL_RADIUS,
  SURFACE,
  TEXT,
  TYPE_SECTION,
  fonts,
} from "@/constants/Variables";
import CloseButton from "@/src/components/CloseButton";
import React from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { legalDocumentStyles } from "./legalDocumentStyles";

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
};

export default function LegalDocumentModal({
  visible,
  title,
  onClose,
  children,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.panel,
            {
              marginTop: insets.top + 12,
              marginBottom: insets.bottom + 12,
            },
          ]}
        >
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>
            <CloseButton onPress={onClose} style={styles.closeBtn} />
          </View>
          <ScrollView
            showsVerticalScrollIndicator
            contentContainerStyle={legalDocumentStyles.scrollContent}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  panel: {
    flex: 1,
    backgroundColor: BG,
    borderRadius: MODAL_RADIUS,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: SURFACE,
  },
  title: {
    flex: 1,
    color: TEXT,
    fontFamily: fonts.heavy,
    fontSize: TYPE_SECTION,
    lineHeight: 26,
    marginRight: 12,
  },
  closeBtn: {
    position: "relative",
    top: 0,
    right: 0,
  },
});
