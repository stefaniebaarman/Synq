import { sheetStyles } from "@/constants/sheetStyles";
import SpringBottomSheet from "@/src/components/sheets/SpringBottomSheet";
import {
  ACCENT,
  BG,
  BORDER,
  DESTRUCTIVE,
  RADIUS_MD,
  SURFACE_ELEVATED,
  TEXT,
  listRowTitleText,
  sheetTitleText,
} from "@/constants/Variables";
import {
  MESSAGE_REACTION_TYPES,
  reactionEmoji,
  type MessageReactionType,
} from "@/src/lib/messageReactions";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  visible: boolean;
  currentReaction?: MessageReactionType | null;
  hasReactors: boolean;
  canReport: boolean;
  onClose: () => void;
  onPickReaction: (type: MessageReactionType) => void;
  onSeeWhoReacted: () => void;
  onReport: () => void;
};

const REACTION_LABELS: Record<MessageReactionType, string> = {
  heart: "Love",
  thumbs_up: "Like",
  laugh: "Laugh",
  emphasize: "Emphasize",
};

export default function MessageReactionSheet({
  visible,
  currentReaction = null,
  hasReactors,
  canReport,
  onClose,
  onPickReaction,
  onSeeWhoReacted,
  onReport,
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
          React
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
      <View style={styles.reactionRow}>
        {MESSAGE_REACTION_TYPES.map((type) => {
          const selected = currentReaction === type;
          const label = REACTION_LABELS[type];
          return (
            <TouchableOpacity
              key={type}
              style={[styles.reactionBtn, selected && styles.reactionBtnSelected]}
              onPress={() => onPickReaction(type)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={
                selected ? `Remove ${label.toLowerCase()}` : label
              }
              accessibilityState={{ selected }}
            >
              <Text style={styles.reactionEmoji}>{reactionEmoji(type)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {hasReactors ? (
        <>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.option}
            onPress={onSeeWhoReacted}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="See who reacted"
          >
            <Ionicons name="people-outline" size={22} color={TEXT} />
            <Text style={styles.optionText}>See who reacted</Text>
          </TouchableOpacity>
        </>
      ) : null}
      {canReport ? (
        <>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.option}
            onPress={onReport}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Report message"
          >
            <Ionicons name="flag-outline" size={22} color={DESTRUCTIVE} />
            <Text style={[styles.optionText, styles.destructiveText]}>
              Report message
            </Text>
          </TouchableOpacity>
        </>
      ) : null}
    </SpringBottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetGroup: {
    paddingHorizontal: 12,
  },
  reactionRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  reactionBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: SURFACE_ELEVATED,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  reactionBtnSelected: {
    borderColor: ACCENT,
    borderWidth: 2,
  },
  reactionEmoji: {
    fontSize: 26,
    lineHeight: 32,
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
    marginHorizontal: 14,
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
