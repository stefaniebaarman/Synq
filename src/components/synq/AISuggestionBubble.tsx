import {
  ACCENT,
  ACCENT_BORDER,
  ACCENT_FILL_SUBTLE,
  HEART_LIKE,
  MUTED2,
  MUTED3,
  SHADOW,
  SURFACE,
  SURFACE_ELEVATED,
  TEXT,
  TYPE_BUTTON,
  TYPE_CAPTION,
  TYPE_CTA,
  TYPE_FINE,
  TYPE_LEAD,
  TYPE_MICRO,
  fonts,
} from "@/constants/Variables";
import { vibeDisplayLabel } from "@/src/data/vibeCategoryImages";
import { formatVenueAddressDisplay, stripLegacyAiPrefix } from "@/src/lib/helpers";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useMemo, useRef } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";

const CARD_RADIUS = 18;

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
            ? `${displayName || displayAddress}. Tap to view on map.`
            : "Tap to view suggestion."
        }
        style={styles.pressable}
      >
        <View style={styles.card}>
          <View style={styles.accentBar} />
          <View style={styles.body}>
            {showVenue ? (
              <>
                <View style={styles.badge}>
                  <Ionicons name="sparkles" size={10} color={ACCENT} />
                  <Text style={styles.badgeText}>{displayCategory}</Text>
                </View>
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
                  <Text style={styles.addressText} numberOfLines={2}>
                    {displayAddress}
                  </Text>
                ) : null}
              </>
            ) : (
              <Text style={styles.legacyBody}>{legacyBody || text}</Text>
            )}
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerHint}>Open in Maps</Text>
            <Ionicons name="arrow-forward" size={13} color={ACCENT} />
          </View>
        </View>

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
    borderRadius: CARD_RADIUS,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
    overflow: "hidden",
  },
  accentBar: {
    height: 3,
    backgroundColor: ACCENT,
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 6,
  },
  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: ACCENT_FILL_SUBTLE,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 4,
  },
  badgeText: {
    color: ACCENT,
    fontFamily: fonts.heavy,
    fontSize: TYPE_MICRO,
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  venueName: {
    color: TEXT,
    fontSize: TYPE_CTA,
    lineHeight: 24,
    fontFamily: fonts.heavy,
    letterSpacing: 0.1,
  },
  whyText: {
    color: ACCENT,
    fontSize: TYPE_CAPTION,
    lineHeight: 18,
    fontFamily: fonts.medium,
  },
  addressText: {
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
    backgroundColor: ACCENT_FILL_SUBTLE,
  },
  footerHint: {
    color: ACCENT,
    fontSize: TYPE_FINE,
    fontFamily: fonts.heavy,
    letterSpacing: 0.2,
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
