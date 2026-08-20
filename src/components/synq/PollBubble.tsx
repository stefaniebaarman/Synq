import {
  ACCENT,
  ACCENT_BORDER,
  ACCENT_FILL,
  MUTED2,
  SURFACE_RAISED,
  SURFACE_SUBTLE,
  TEXT,
  TYPE_CAPTION,
  TYPE_FINE,
  TYPE_MICRO,
  TYPE_SUBHEAD,
  fonts,
} from "@/constants/Variables";
import { parsePollVotes, pollVoteCounts } from "@/src/lib/chatPoll";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

const CARD_RADIUS = 20;

type Props = {
  question: string;
  options: string[];
  votes?: Record<string, number>;
  currentUserId?: string;
  onVote: (optionIndex: number) => void;
  onLongPress?: () => void;
};

export default function PollBubble({
  question,
  options,
  votes,
  currentUserId,
  onVote,
  onLongPress,
}: Props) {
  const parsedVotes = useMemo(() => parsePollVotes(votes), [votes]);
  const counts = useMemo(
    () => pollVoteCounts(options.length, parsedVotes),
    [options.length, parsedVotes]
  );
  const total = useMemo(
    () => counts.reduce((sum, count) => sum + count, 0),
    [counts]
  );
  const myVote =
    currentUserId && currentUserId in parsedVotes
      ? parsedVotes[currentUserId]
      : null;

  const displayQuestion = question.trim();

  return (
    <View
      style={styles.card}
      accessibilityRole="summary"
      accessibilityLabel={
        displayQuestion
          ? `Poll. ${displayQuestion}. ${total} ${total === 1 ? "vote" : "votes"}.`
          : `Poll. ${total} ${total === 1 ? "vote" : "votes"}.`
      }
    >
      <View style={styles.badge}>
        <Text style={styles.badgeText}>Poll</Text>
      </View>
      {displayQuestion ? (
        <Text style={styles.question}>{displayQuestion}</Text>
      ) : null}
      <View style={styles.options}>
        {options.map((option, index) => {
          const count = counts[index] ?? 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const selected = myVote === index;
          return (
            <Pressable
              key={`${index}-${option}`}
              onPress={() => onVote(index)}
              onLongPress={onLongPress}
              delayLongPress={400}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${option}. ${count} ${count === 1 ? "vote" : "votes"}.`}
              style={[styles.option, selected && styles.optionSelected]}
            >
              {pct > 0 ? (
                <View
                  pointerEvents="none"
                  style={[styles.optionFill, { width: `${pct}%` }]}
                />
              ) : null}
              <View style={styles.optionContent}>
                <Text style={styles.optionLabel} numberOfLines={2}>
                  {option}
                </Text>
                <View style={styles.optionMeta}>
                  {selected ? (
                    <Ionicons name="checkmark-circle" size={16} color={ACCENT} />
                  ) : null}
                  <Text style={styles.optionCount}>{total > 0 ? `${pct}%` : ""}</Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.footer}>
        {total === 1 ? "1 vote" : `${total} votes`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    backgroundColor: SURFACE_RAISED,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    overflow: "hidden",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    marginBottom: 8,
  },
  badgeText: {
    color: ACCENT,
    fontFamily: fonts.medium,
    fontSize: TYPE_MICRO,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  question: {
    color: TEXT,
    fontFamily: fonts.heavy,
    fontSize: TYPE_SUBHEAD,
    lineHeight: 22,
    marginBottom: 12,
  },
  options: {
    gap: 8,
  },
  option: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SURFACE_SUBTLE,
    backgroundColor: SURFACE_SUBTLE,
    overflow: "hidden",
  },
  optionSelected: {
    borderColor: ACCENT_BORDER,
  },
  optionFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: ACCENT_FILL,
  },
  optionContent: {
    minHeight: 42,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  optionLabel: {
    flex: 1,
    color: TEXT,
    fontFamily: fonts.medium,
    fontSize: TYPE_CAPTION,
    lineHeight: 18,
    zIndex: 1,
    paddingRight: 8,
  },
  optionMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    zIndex: 1,
  },
  optionCount: {
    color: MUTED2,
    fontFamily: fonts.medium,
    fontSize: TYPE_FINE,
    minWidth: 28,
    textAlign: "right",
  },
  footer: {
    marginTop: 10,
    color: MUTED2,
    fontFamily: fonts.book,
    fontSize: TYPE_FINE,
  },
});
