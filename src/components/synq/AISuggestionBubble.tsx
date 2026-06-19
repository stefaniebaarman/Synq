import {
  BORDER,
  MUTED2,
  MUTED3,
  SURFACE,
  SURFACE_ELEVATED,
  TEXT,
  TYPE_BUTTON,
  TYPE_CTA,
  TYPE_FINE,
  TYPE_LEAD,
  fonts,
} from "@/constants/Variables";
import { formatVenueAddressDisplay, stripLegacyAiPrefix } from "@/src/lib/helpers";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const CARD_RADIUS = 16;

type Props = {
  text: string;
  isLegacy: boolean;
  name?: string;
  address?: string;
  onPress: () => void;
  heartCount?: number;
};

export default function AISuggestionBubble({
  text,
  isLegacy,
  name,
  address,
  onPress,
  heartCount = 0,
}: Props) {
  const legacyBody = stripLegacyAiPrefix(text);
  const displayName = name?.trim() || "";
  const displayAddress = formatVenueAddressDisplay(address || "");
  const showVenue = !isLegacy && (displayName || displayAddress);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        showVenue
          ? `${displayName || displayAddress}. Tap to view on map.`
          : "Tap to view suggestion."
      }
      style={({ pressed }) => [styles.pressable, pressed && styles.pressablePressed]}
    >
      <View style={styles.card}>
        <View style={styles.body}>
          {showVenue ? (
            <>
              {displayName ? (
                <Text style={styles.venueName} numberOfLines={2}>
                  {displayName}
                </Text>
              ) : null}
              {displayAddress ? (
                <View style={styles.addressRow}>
                  <Ionicons
                    name="location-outline"
                    size={13}
                    color={MUTED2}
                    style={styles.addressIcon}
                  />
                  <Text style={styles.addressText} numberOfLines={2}>
                    {displayAddress}
                  </Text>
                </View>
              ) : null}
            </>
          ) : (
            <Text style={styles.legacyBody}>{legacyBody || text}</Text>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerHint}>View on map</Text>
          <Ionicons name="chevron-forward" size={12} color={MUTED3} />
        </View>
      </View>

      {heartCount > 0 ? (
        <View style={styles.heartReaction}>
          {Array.from({ length: heartCount }, (_, i) => (
            <View
              key={i}
              style={[styles.heartReactionBadge, i > 0 && styles.heartReactionOverlap]}
            >
              <Ionicons name="heart" size={12} color="#FF2D55" />
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    width: "100%",
    position: "relative",
    overflow: "visible",
  },
  pressablePressed: {
    opacity: 0.92,
  },
  card: {
    borderRadius: CARD_RADIUS,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 8,
  },
  venueName: {
    color: TEXT,
    fontSize: TYPE_CTA,
    lineHeight: 24,
    fontFamily: fonts.heavy,
    letterSpacing: 0.1,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4,
  },
  addressIcon: {
    marginTop: 2,
  },
  addressText: {
    flex: 1,
    color: MUTED2,
    fontSize: TYPE_LEAD,
    lineHeight: 20,
    fontFamily: fonts.book,
  },
  legacyBody: {
    color: TEXT,
    fontSize: TYPE_BUTTON,
    lineHeight: 22,
    fontFamily: fonts.book,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
  },
  footerHint: {
    color: MUTED3,
    fontSize: TYPE_FINE,
    fontFamily: fonts.medium,
    letterSpacing: 0.15,
  },
  heartReaction: {
    position: "absolute",
    bottom: -10,
    right: -10,
    flexDirection: "row",
    alignItems: "center",
  },
  heartReactionBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: SURFACE_ELEVATED,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.35,
        shadowRadius: 2,
      },
      android: { elevation: 2 },
    }),
  },
  heartReactionOverlap: {
    marginLeft: -5,
  },
});
