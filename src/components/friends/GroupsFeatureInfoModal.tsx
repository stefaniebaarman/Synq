import {
  BG,
  BORDER_SOFT,
  MODAL_RADIUS,
  OVERLAY_DARK,
  emptyStateTitleText,
  modalBodyText,
} from "@/constants/Variables";
import CloseButton from "@/src/components/CloseButton";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

export type GroupsFeatureInfoVariant = "circles" | "community";

type Props = {
  visible: boolean;
  variant: GroupsFeatureInfoVariant;
  onClose: () => void;
};

const COPY: Record<
  GroupsFeatureInfoVariant,
  {
    title: string;
    body: string;
  }
> = {
  circles: {
    title: "Circles",
    body:
      "Private friend lists you create. Share your availability with only those people.",
  },
  community: {
    title: "Communities",
    body:
      "Open groups around a shared interest. Anyone can join to meet people beyond your circle.",
  },
};

export default function GroupsFeatureInfoModal({ visible, variant, onClose }: Props) {
  const content = COPY[variant];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Dismiss" />
        <View style={styles.card}>
          <CloseButton onPress={onClose} style={styles.close} />
          <Text style={styles.title}>{content.title}</Text>
          <Text style={styles.body}>{content.body}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: OVERLAY_DARK,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
  },
  card: {
    width: "100%",
    backgroundColor: BG,
    borderRadius: MODAL_RADIUS,
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER_SOFT,
    alignItems: "center",
  },
  close: {
    position: "absolute",
    top: 14,
    right: 14,
    zIndex: 1,
  },
  title: {
    ...emptyStateTitleText,
    marginBottom: 10,
    textAlign: "center",
    paddingHorizontal: 28,
  },
  body: {
    ...modalBodyText,
    lineHeight: 22,
    textAlign: "center",
  },
});
