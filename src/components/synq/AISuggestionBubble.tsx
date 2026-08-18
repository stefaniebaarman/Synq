import {
  ACCENT,
  ACCENT_BORDER,
  HEART_LIKE,
  MUTED3,
  SHADOW,
  SURFACE,
  SURFACE_ELEVATED,
  SURFACE_SUBTLE,
  TEXT,
  TYPE_BUTTON,
  TYPE_CAPTION,
  TYPE_FINE,
  TYPE_MICRO,
  fonts,
  synqOutlineAddBtnCompact,
  synqOutlineAddBtnTextCompact,
} from "@/constants/Variables";
import { vibeCategoryImageUrl, vibeDisplayLabel } from "@/src/data/vibeCategoryImages";
import { formatVenueAddressDisplay, stripLegacyAiPrefix } from "@/src/lib/helpers";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useMemo, useRef } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";

const CARD_RADIUS = 20;
const HERO_HEIGHT = 196;

type Props = {
  text: string;
  isLegacy: boolean;
  name?: string;
  address?: string;
  why?: string;
  category?: string;
  onPress: () => void;
  onLongPress?: () => void;
  heartCount?: number;
};

export default function AISuggestionBubble({
  text,
  isLegacy,
  name,
  address,
  why,
  category,
  onPress,
  onLongPress,
  heartCount = 0,
}: Props) {
  const legacyBody = stripLegacyAiPrefix(text);
  const displayName = name?.trim() || "";
  const displayAddress = formatVenueAddressDisplay(address || "");
  const displayWhy = why?.trim() || "";
  const displayCategory = vibeDisplayLabel(category || "") || "Spot";
  const showVenue = !isLegacy && (displayName || displayAddress);
  const imageUrl = vibeCategoryImageUrl(category || "");

  const onPressRef = useRef(onPress);
  const onLongPressRef = useRef(onLongPress);
  onPressRef.current = onPress;
  onLongPressRef.current = onLongPress;

  const invokePress = useCallback(() => {
    onPressRef.current();
  }, []);
  const invokeLongPress = useCallback(() => {
    onLongPressRef.current?.();
  }, []);

  const bubbleGesture = useMemo(() => {
    const tap = Gesture.Tap().onEnd(() => {
      "worklet";
      runOnJS(invokePress)();
    });
    const longPress = Gesture.LongPress()
      .minDuration(400)
      .maxDistance(14)
      .onStart(() => {
        "worklet";
        runOnJS(invokeLongPress)();
      });
    return Gesture.Exclusive(longPress, tap);
  }, [invokeLongPress, invokePress]);

  return (
    <GestureDetector gesture={bubbleGesture}>
      <View
        collapsable={false}
        accessibilityRole="button"
        accessibilityLabel={
          showVenue
            ? `${displayCategory}. ${displayName || displayAddress}. Tap to view on map.`
            : "Tap to view suggestion."
        }
        style={styles.pressable}
      >
        {showVenue ? (
          <View style={styles.card}>
            <ExpoImage
              source={{ uri: imageUrl }}
              style={styles.hero}
              contentFit="cover"
              cachePolicy="memory-disk"
              recyclingKey={imageUrl}
            />
            <View style={styles.heroDim} />
            <LinearGradient
              colors={[
                "rgba(0,0,0,0.38)",
                "rgba(0,0,0,0.52)",
                "rgba(0,0,0,0.78)",
                "rgba(0,0,0,0.94)",
              ]}
              locations={[0, 0.22, 0.48, 1]}
              style={styles.scrim}
            >
              <View style={[synqOutlineAddBtnCompact, styles.badge]}>
                <Text style={[synqOutlineAddBtnTextCompact, styles.badgeText]}>
                  {displayCategory}
                </Text>
              </View>
              <View style={styles.copy}>
                {displayName ? (
                  <Text style={styles.venueName} numberOfLines={2}>
                    {displayName}
                  </Text>
                ) : null}
                {displayWhy ? (
                  <Text style={styles.whyText} numberOfLines={1}>
                    {displayWhy}
                  </Text>
                ) : null}
                {displayAddress ? (
                  <Text style={styles.addressText} numberOfLines={1}>
                    {displayAddress}
                  </Text>
                ) : null}
                <View style={styles.mapsRow}>
                  <Text style={styles.mapsHint}>Open in Maps</Text>
                  <Ionicons name="arrow-forward" size={13} color={ACCENT} />
                </View>
              </View>
            </LinearGradient>
          </View>
        ) : (
          <View style={styles.legacyCard}>
            <Text style={styles.legacyBody}>{legacyBody || text}</Text>
          </View>
        )}

        {heartCount > 0 ? (
          <View style={styles.heartReaction}>
            {Array.from({ length: heartCount }, (_, i) => (
              <View
                key={i}
                style={[styles.heartReactionBadge, i > 0 && styles.heartReactionOverlap]}
              >
                <Ionicons name="heart" size={12} color={HEART_LIKE} />
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  pressable: {
    width: "100%",
    position: "relative",
    overflow: "visible",
  },
  card: {
    height: HERO_HEIGHT,
    borderRadius: CARD_RADIUS,
    overflow: "hidden",
    backgroundColor: SURFACE_SUBTLE,
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
  },
  hero: {
    ...StyleSheet.absoluteFillObject,
  },
  heroDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
  },
  badge: {
    alignSelf: "flex-start",
    minWidth: 0,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  badgeText: {
    fontSize: TYPE_MICRO,
    lineHeight: 13,
    letterSpacing: 0.2,
  },
  copy: {
    gap: 3,
  },
  venueName: {
    color: "#FFFFFF",
    fontSize: 20,
    lineHeight: 24,
    fontFamily: fonts.heavy,
    letterSpacing: -0.2,
  },
  whyText: {
    color: ACCENT,
    fontSize: TYPE_CAPTION,
    lineHeight: 18,
    fontFamily: fonts.medium,
  },
  addressText: {
    color: "rgba(255,255,255,0.68)",
    fontSize: TYPE_FINE,
    lineHeight: 16,
    fontFamily: fonts.book,
  },
  mapsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.16)",
  },
  mapsHint: {
    color: ACCENT,
    fontSize: TYPE_FINE,
    fontFamily: fonts.heavy,
    letterSpacing: 0.2,
  },
  legacyCard: {
    borderRadius: CARD_RADIUS,
    backgroundColor: SURFACE,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  legacyBody: {
    color: TEXT,
    fontSize: TYPE_BUTTON,
    lineHeight: 22,
    fontFamily: fonts.book,
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
  heartReactionOverlap: {
    marginLeft: -5,
  },
});
