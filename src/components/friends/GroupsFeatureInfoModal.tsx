import {
  ACCENT,
  BG,
  BUTTON_RADIUS,
  MODAL_RADIUS,
  MUTED2,
  ON_ACCENT_TEXT,
  TEXT,
  TYPE_BODY,
  TYPE_SECTION,
  fonts,
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
            <Text style={styles.buttonText}>Got it</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
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
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
  },
  title: {
    fontFamily: fonts.heavy,
    fontSize: TYPE_SECTION,
    color: TEXT,
    letterSpacing: 0.06,
    marginBottom: 10,
    textAlign: "center",
  },
  body: {
    fontFamily: fonts.book,
    fontSize: TYPE_BODY,
    color: MUTED2,
    lineHeight: 22,
    letterSpacing: 0.02,
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
  buttonText: {
    fontFamily: fonts.heavy,
    fontSize: TYPE_BODY,
    color: ON_ACCENT_TEXT,
    letterSpacing: 0.04,
  },
});
