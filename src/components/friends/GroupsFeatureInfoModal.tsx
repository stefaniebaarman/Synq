import {
  ACCENT,
  BG,
  BORDER_SOFT,
  BUTTON_RADIUS,
  MODAL_RADIUS,
  OVERLAY_DARK,
  emptyStateTitleText,
  modalBodyText,
  primaryButtonText,
} from "@/constants/Variables";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
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
  body: "Choose exactly who sees when you're available.",
},

community: {
  title: "Communities",
  body: "Meet new people through shared interests.",
},
};

export default function GroupsFeatureInfoModal({ visible, variant, onClose }: Props) {
  const content = COPY[variant];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Dismiss" />
        <View style={styles.card}>
          <Text style={styles.title}>{content.title}</Text>
          <Text style={styles.body}>{content.body}</Text>

          <TouchableOpacity
            style={styles.button}
            onPress={onClose}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Got it"
          >
            <Text style={primaryButtonText}>Got it</Text>
          </TouchableOpacity>
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
  title: {
    ...emptyStateTitleText,
    marginBottom: 10,
    textAlign: "center",
  },
  body: {
    ...modalBodyText,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 22,
  },
  button: {
    minWidth: 140,
    borderRadius: BUTTON_RADIUS,
    paddingVertical: 13,
    paddingHorizontal: 28,
    alignItems: "center",
    backgroundColor: ACCENT,
  },
});
