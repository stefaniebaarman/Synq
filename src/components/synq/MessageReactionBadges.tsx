import {
  HEART_LIKE,
  MUTED3,
  SHADOW,
  SURFACE_ELEVATED,
} from "@/constants/Variables";
import {
  MESSAGE_REACTION_TYPES,
  reactionEmoji,
  totalReactionCount,
  type MessageReactionCounts,
} from "@/src/lib/messageReactions";
import { Ionicons } from "@expo/vector-icons";
import { Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

type Props = {
  counts: MessageReactionCounts;
  style?: StyleProp<ViewStyle>;
};

export default function MessageReactionBadges({ counts, style }: Props) {
  if (totalReactionCount(counts) <= 0) return null;

  let rendered = 0;
  return (
    <View style={[styles.row, style]}>
      {MESSAGE_REACTION_TYPES.flatMap((type) =>
        Array.from({ length: counts[type] }, (_, i) => {
          const overlap = rendered > 0;
          rendered += 1;
          return (
            <View
              key={`${type}-${i}`}
              style={[styles.badge, overlap && styles.overlap]}
            >
              {type === "heart" ? (
                <Ionicons name="heart" size={12} color={HEART_LIKE} />
              ) : (
                <Text style={styles.emoji}>{reactionEmoji(type)}</Text>
              )}
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: "absolute",
    bottom: -10,
    flexDirection: "row",
    alignItems: "center",
  },
  badge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: SURFACE_ELEVATED,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: MUTED3,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: SHADOW,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.35,
        shadowRadius: 2,
      },
      android: { elevation: 2 },
    }),
  },
  overlap: {
    marginLeft: -5,
  },
  emoji: {
    fontSize: 11,
    lineHeight: 13,
  },
});
