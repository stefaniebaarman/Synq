import { resolveAvatar } from "@/src/lib/helpers";
import {
  ACCENT,
  ACCENT_BORDER,
  ACCENT_FILL_SUBTLE,
  BORDER_SOFT,
  MUTED2,
  RADIUS_MD,
  TEXT,
  TYPE_BUTTON,
  TYPE_CAPTION,
  TYPE_FINE,
  fonts,
} from "@/constants/Variables";
import {
  GROUP_BORDER,
  GROUP_SURFACE,
} from "@/src/components/friends/groupsListStyles";
import { Image as ExpoImage } from "expo-image";
import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export type SynqNudgeCardProps = {
  onNudge: () => void;
  loading?: boolean;
  sent?: boolean;
  /** When set, renders a list-row layout with avatar and name. */
  friend?: { displayName?: string; imageurl?: string };
  /** Name + nudge button only (active Synq empty state). */
  variant?: "default" | "compact";
};

export default function SynqNudgeCard({
  onNudge,
  loading = false,
  sent = false,
  friend,
  variant = "default",
}: SynqNudgeCardProps) {
  const disabled = sent || loading;
  const firstName =
    friend?.displayName?.trim().split(/\s+/)[0] || "They";
  const showAvatar = !!friend;
  const compact = variant === "compact";

  return (
    <View style={[styles.card, sent && styles.cardSent]}>
      {showAvatar ? (
        <ExpoImage
          source={{ uri: resolveAvatar(friend?.imageurl) }}
          style={styles.avatar}
          cachePolicy="memory-disk"
          transition={0}
        />
      ) : null}

      <View style={styles.copy}>
        {compact ? (
          <Text style={styles.name} numberOfLines={1}>
            {firstName}
          </Text>
        ) : (
          <>
            <Text style={[styles.kicker, sent && styles.kickerSent]}>
              {sent ? "Nudge sent" : "Inactive right now"}
            </Text>
            {!sent ? (
              <Text style={styles.subtitle} numberOfLines={2}>
                {friend
                  ? `See if ${firstName} is free`
                  : "See if they're free"}
              </Text>
            ) : null}
          </>
        )}
      </View>

      <TouchableOpacity
        activeOpacity={0.8}
        style={[styles.cta, sent && styles.ctaSent]}
        onPress={onNudge}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={
          sent
            ? `Nudge already sent${friend ? ` to ${friend.displayName}` : ""}`
            : `Nudge${friend ? ` ${friend.displayName}` : ""}`
        }
      >
        {loading ? (
          <ActivityIndicator size="small" color={sent ? MUTED2 : ACCENT} />
        ) : (
          <Text style={[styles.ctaText, sent && styles.ctaTextSent]}>
            {sent ? "Nudged" : "Nudge"}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: GROUP_SURFACE,
    borderRadius: RADIUS_MD,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GROUP_BORDER,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  cardSent: {
    borderColor: GROUP_BORDER,
    backgroundColor: GROUP_SURFACE,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER_SOFT,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  kicker: {
    color: MUTED2,
    fontFamily: fonts.medium,
    fontSize: TYPE_FINE,
    lineHeight: 16,
    letterSpacing: 0.1,
  },
  kickerSent: {
    color: TEXT,
    fontFamily: fonts.medium,
    fontSize: TYPE_BUTTON,
    lineHeight: 20,
  },
  subtitle: {
    color: TEXT,
    fontFamily: fonts.book,
    fontSize: TYPE_BUTTON,
    lineHeight: 21,
    opacity: 0.92,
  },
  name: {
    color: TEXT,
    fontFamily: fonts.medium,
    fontSize: TYPE_BUTTON,
    lineHeight: 21,
  },
  cta: {
    minWidth: 58,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
    backgroundColor: ACCENT_FILL_SUBTLE,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaSent: {
    borderColor: BORDER_SOFT,
    backgroundColor: "transparent",
  },
  ctaText: {
    color: ACCENT,
    fontFamily: fonts.medium,
    fontSize: TYPE_CAPTION,
    letterSpacing: 0.1,
  },
  ctaTextSent: {
    color: MUTED2,
  },
});
