import {
  ACCENT,
  ACCENT_FILL_WHISPER,
  MUTED2,
  MUTED3,
  ON_ACCENT_TEXT,
  RADIUS_LG,
  RADIUS_XL,
  SURFACE_FAINT,
  TEXT,
  TYPE_BODY,
  TYPE_BUTTON,
  TYPE_CAPTION,
  TYPE_FINE,
  fonts,
} from "@/constants/Variables";
import {
  ONBOARDING_HERO_WIDTH,
  ONBOARDING_PULSE_SIZE,
} from "@/constants/onboardingLayout";
import { Image as ExpoImage } from "expo-image";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

const EASE_OUT = Easing.out(Easing.cubic);
const SIN = Easing.inOut(Easing.sin);
const GLOW_SIZE = ONBOARDING_PULSE_SIZE * 0.72;
const GLOW_INSET = (ONBOARDING_PULSE_SIZE - GLOW_SIZE) / 2;

/**
 * Step 1 — Immersive Synq pulse.
 */
export function PulseHeroGraphic() {
  const reduced = useReducedMotion();
  const glow = useSharedValue(0.14);
  const ring = useSharedValue(0.85);

  useEffect(() => {
    if (reduced) return;
    glow.value = withRepeat(
      withSequence(
        withTiming(0.22, { duration: 2400, easing: SIN }),
        withTiming(0.1, { duration: 2400, easing: SIN })
      ),
      -1,
      true
    );
    ring.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 2800, easing: SIN }),
        withTiming(0.9, { duration: 2800, easing: SIN })
      ),
      -1,
      true
    );
  }, [glow, reduced, ring]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ scale: ring.value }],
  }));

  return (
    <View
      style={styles.pulseCluster}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={[styles.glow, glowStyle]} />
      <ExpoImage
        source={require("../../../assets/pulse.gif")}
        style={styles.pulse}
        contentFit="contain"
        cachePolicy="memory-disk"
        transition={0}
      />
    </View>
  );
}

const FREE_FRIENDS = [
  { name: "Maya", memo: "Drinks tonight?" },
  { name: "Jordan", memo: "Down for coffee" },
  { name: "Sam", memo: "Quick bite?" },
] as const;

/**
 * Step 2 — Who's free.
 * Friends appear one by one as they Synq.
 */
export function WhosFreeGraphic() {
  const reduced = useReducedMotion();
  const progress = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) {
      progress.value = 1;
      return;
    }
    progress.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 3600, easing: EASE_OUT }),
        withTiming(1, { duration: 1100 }),
        withTiming(0, { duration: 0 }),
        withTiming(0, { duration: 650 })
      ),
      -1,
      false
    );
  }, [progress, reduced]);

  return (
    <View style={styles.panel} accessibilityLabel="Friends becoming free">
      <View style={styles.freeList}>
        {FREE_FRIENDS.map((friend, index) => (
          <FreeFriendCard
            key={friend.name}
            name={friend.name}
            memo={friend.memo}
            index={index}
            progress={progress}
            reduced={!!reduced}
          />
        ))}
      </View>
    </View>
  );
}

function FreeFriendCard({
  name,
  memo,
  index,
  progress,
  reduced,
}: {
  name: string;
  memo: string;
  index: number;
  progress: SharedValue<number>;
  reduced: boolean;
}) {
  const start = index / FREE_FRIENDS.length;
  const end = (index + 0.55) / FREE_FRIENDS.length;

  const style = useAnimatedStyle(() => {
    const t = reduced
      ? 1
      : interpolate(progress.value, [start, end], [0, 1], "clamp");
    return {
      opacity: t,
      transform: [
        { translateY: (1 - t) * 22 },
        { scale: 0.94 + t * 0.06 },
      ],
    };
  });

  const ringStyle = useAnimatedStyle(() => {
    const t = reduced
      ? 1
      : interpolate(progress.value, [start, end], [0, 1], "clamp");
    return {
      opacity: t,
      transform: [{ scale: 0.7 + t * 0.3 }],
    };
  });

  return (
    <Animated.View style={[styles.freeCard, style]}>
      <View style={styles.freeAvatarWrap}>
        <Animated.View style={[styles.freeRing, ringStyle]} />
        <View style={styles.freeAvatar}>
          <Text style={styles.freeLetter}>{name[0]}</Text>
        </View>
      </View>
      <View style={styles.freeCopy}>
        <Text style={styles.freeName}>{name}</Text>
        <Text style={styles.freeMemo} numberOfLines={1}>
          {memo}
        </Text>
      </View>
    </Animated.View>
  );
}

/**
 * Step 3 — Connect.
 * A short chat with a friend, including typing.
 */
export function JumpInGraphic() {
  const reduced = useReducedMotion();
  const scene = useSharedValue(reduced ? 1 : 0);
  const typing = useSharedValue(reduced ? 0 : 0);

  useEffect(() => {
    if (reduced) {
      scene.value = 1;
      typing.value = 0;
      return;
    }
    scene.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 4200, easing: EASE_OUT }),
        withTiming(1, { duration: 1400 }),
        withTiming(0, { duration: 0 }),
        withTiming(0, { duration: 500 })
      ),
      -1,
      false
    );
    typing.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 420, easing: SIN }),
        withTiming(0.35, { duration: 420, easing: SIN })
      ),
      -1,
      true
    );
  }, [reduced, scene, typing]);

  const headerStyle = useAnimatedStyle(() => {
    const t = reduced
      ? 1
      : interpolate(scene.value, [0, 0.12], [0, 1], "clamp");
    return { opacity: t };
  });

  const m1 = useAnimatedStyle(() => {
    const t = reduced
      ? 1
      : interpolate(scene.value, [0.1, 0.28], [0, 1], "clamp");
    return {
      opacity: t,
      transform: [{ translateY: (1 - t) * 12 }, { scale: 0.96 + t * 0.04 }],
    };
  });

  const m2 = useAnimatedStyle(() => {
    const t = reduced
      ? 1
      : interpolate(scene.value, [0.28, 0.44], [0, 1], "clamp");
    return {
      opacity: t,
      transform: [{ translateY: (1 - t) * 12 }, { scale: 0.96 + t * 0.04 }],
    };
  });

  const typingWrap = useAnimatedStyle(() => {
    const show = reduced
      ? 0
      : interpolate(scene.value, [0.46, 0.54, 0.68, 0.74], [0, 1, 1, 0], "clamp");
    return {
      opacity: show,
      transform: [{ translateY: (1 - show) * 8 }],
    };
  });

  const dot1 = useAnimatedStyle(() => ({
    opacity: reduced ? 0.45 : 0.35 + typing.value * 0.65,
    transform: [{ translateY: reduced ? 0 : -typing.value * 2.5 }],
  }));
  const dot2 = useAnimatedStyle(() => ({
    opacity: reduced ? 0.55 : 0.45 + (1 - typing.value) * 0.4,
    transform: [{ translateY: reduced ? 0 : -(1 - typing.value) * 2 }],
  }));
  const dot3 = useAnimatedStyle(() => ({
    opacity: reduced ? 0.45 : 0.35 + (1 - typing.value) * 0.65,
    transform: [{ translateY: reduced ? 0 : -(1 - typing.value) * 2.5 }],
  }));

  const m3 = useAnimatedStyle(() => {
    const t = reduced
      ? 1
      : interpolate(scene.value, [0.72, 0.88], [0, 1], "clamp");
    return {
      opacity: t,
      transform: [{ translateY: (1 - t) * 12 }, { scale: 0.96 + t * 0.04 }],
    };
  });

  return (
    <View style={styles.panel} accessibilityLabel="Chat with a friend">
      <View style={styles.jumpStage}>
        <Animated.View style={[styles.chatHeader, headerStyle]}>
          <View style={styles.chatAvatar}>
            <Text style={styles.chatAvatarLetter}>M</Text>
          </View>
          <View style={styles.chatHeaderCopy}>
            <Text style={styles.chatName}>Maya</Text>
            <Text style={styles.chatStatus}>Active now</Text>
          </View>
        </Animated.View>

        <Animated.View style={[styles.bubbleOut, m1]}>
          <Text style={styles.bubbleText}>Want to grab coffee?</Text>
        </Animated.View>

        <Animated.View style={[styles.bubbleIn, m2]}>
          <Text style={styles.bubbleTextDark}>Yeah, I&apos;m down</Text>
        </Animated.View>

        <Animated.View style={[styles.typingBubble, typingWrap]}>
          <Animated.View style={[styles.typingDot, dot1]} />
          <Animated.View style={[styles.typingDot, dot2]} />
          <Animated.View style={[styles.typingDot, dot3]} />
        </Animated.View>

        <Animated.View style={[styles.bubbleOut, m3]}>
          <Text style={styles.bubbleText}>Meet at the usual spot?</Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pulseCluster: {
    width: ONBOARDING_PULSE_SIZE,
    height: ONBOARDING_PULSE_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  glow: {
    position: "absolute",
    top: GLOW_INSET,
    left: GLOW_INSET,
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    borderRadius: GLOW_SIZE / 2,
    backgroundColor: ACCENT,
  },
  pulse: {
    width: ONBOARDING_PULSE_SIZE,
    height: ONBOARDING_PULSE_SIZE,
  },
  panel: {
    width: ONBOARDING_HERO_WIDTH,
    alignItems: "center",
  },
  freeList: {
    gap: 12,
    alignSelf: "stretch",
  },
  freeCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: ACCENT_FILL_WHISPER,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,255,133,0.22)",
  },
  freeAvatarWrap: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  freeRing: {
    position: "absolute",
    width: 48,
    height: 48,
    borderRadius: RADIUS_XL,
    borderWidth: 1.5,
    borderColor: ACCENT,
  },
  freeAvatar: {
    width: 40,
    height: 40,
    borderRadius: RADIUS_LG,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  freeLetter: {
    color: ON_ACCENT_TEXT,
    fontFamily: fonts.heavy,
    fontSize: 15,
  },
  freeCopy: {
    flex: 1,
    minWidth: 0,
  },
  freeName: {
    color: TEXT,
    fontFamily: fonts.heavy,
    fontSize: TYPE_BODY,
  },
  freeMemo: {
    marginTop: 2,
    color: MUTED2,
    fontFamily: fonts.book,
    fontSize: TYPE_CAPTION,
  },
  jumpStage: {
    width: "100%",
    paddingTop: 8,
    gap: 10,
  },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    alignSelf: "stretch",
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  chatAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  chatAvatarLetter: {
    color: ON_ACCENT_TEXT,
    fontFamily: fonts.heavy,
    fontSize: 15,
  },
  chatHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  chatName: {
    color: TEXT,
    fontFamily: fonts.heavy,
    fontSize: TYPE_BODY,
  },
  chatStatus: {
    marginTop: 1,
    color: ACCENT,
    fontFamily: fonts.book,
    fontSize: TYPE_FINE,
  },
  bubbleOut: {
    alignSelf: "flex-start",
    maxWidth: "88%",
    backgroundColor: SURFACE_FAINT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: MUTED3,
    borderRadius: 22,
    borderBottomLeftRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bubbleIn: {
    alignSelf: "flex-end",
    maxWidth: "88%",
    backgroundColor: ACCENT,
    borderRadius: 22,
    borderBottomRightRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  typingBubble: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: SURFACE_FAINT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: MUTED3,
    borderRadius: 22,
    borderBottomLeftRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: MUTED2,
  },
  bubbleText: {
    color: TEXT,
    fontFamily: fonts.book,
    fontSize: TYPE_BUTTON,
  },
  bubbleTextDark: {
    color: ON_ACCENT_TEXT,
    fontFamily: fonts.medium,
    fontSize: TYPE_BUTTON,
  },
});
