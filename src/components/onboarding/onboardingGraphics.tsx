import {
  ACCENT,
  ACCENT_FILL_WHISPER,
  MUTED2,
  MUTED3,
  ON_ACCENT_TEXT,
  RADIUS_MD,
  SURFACE_FAINT,
  TEXT,
  TYPE_BUTTON,
  TYPE_CAPTION,
  fonts,
} from "@/constants/Variables";
import { Image as ExpoImage } from "expo-image";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
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

const MOODS = [
  "What are you down for?",
  "Drinks tonight?",
  "Coffee nearby?",
  "Quick bite?",
];

/**
 * Step 1 — Go live.
 * Original Synq pulse + mood + TAP TO ACTIVATE.
 */
export function GoLiveGraphic() {
  const reduced = useReducedMotion();
  const cta = useSharedValue(0.7);
  const [moodIndex, setMoodIndex] = useState(0);
  const moodOpacity = useSharedValue(1);

  useEffect(() => {
    if (reduced) return;
    cta.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2200, easing: SIN }),
        withTiming(0.55, { duration: 2200, easing: SIN })
      ),
      -1,
      true
    );
  }, [cta, reduced]);

  useEffect(() => {
    if (reduced) return;
    const advance = () => setMoodIndex((i) => (i + 1) % MOODS.length);
    const id = setInterval(() => {
      moodOpacity.value = withTiming(0, { duration: 420 }, (done) => {
        if (done) {
          runOnJS(advance)();
          moodOpacity.value = withTiming(1, { duration: 480 });
        }
      });
    }, 3200);
    return () => clearInterval(id);
  }, [moodOpacity, reduced]);

  const ctaStyle = useAnimatedStyle(() => ({ opacity: cta.value }));
  const moodStyle = useAnimatedStyle(() => ({ opacity: moodOpacity.value }));

  return (
    <View style={styles.goLive} accessibilityLabel="Tap to activate Synq">
      <View style={styles.moodPill}>
        <Animated.Text style={[styles.moodText, moodStyle]} numberOfLines={1}>
          {MOODS[moodIndex]}
        </Animated.Text>
      </View>

      <ExpoImage
        source={require("../../../assets/pulse.gif")}
        style={styles.pulse}
        contentFit="contain"
        cachePolicy="memory-disk"
        transition={0}
      />

      <Animated.Text style={[styles.tapCta, ctaStyle]}>
        TAP TO ACTIVATE
      </Animated.Text>
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
 * Friends appear one by one as they Synq. Clear cause → effect.
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
    <View style={styles.freeStage} accessibilityLabel="Friends becoming free">
      <View style={styles.youRow}>
        <View style={styles.youAvatar}>
          <Text style={styles.youLetter}>Y</Text>
        </View>
        <Text style={styles.youLabel}>You · Synq is active</Text>
        <View style={styles.youDot} />
      </View>

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
 * Step 3 — Jump in.
 * Chat bubbles only — plan forms from the conversation.
 */
export function JumpInGraphic() {
  const reduced = useReducedMotion();
  const scene = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) {
      scene.value = 1;
      return;
    }
    scene.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2600, easing: EASE_OUT }),
        withTiming(1, { duration: 1600 }),
        withTiming(0, { duration: 0 }),
        withTiming(0, { duration: 500 })
      ),
      -1,
      false
    );
  }, [reduced, scene]);

  const bubbleStyle = useAnimatedStyle(() => {
    const t = reduced
      ? 1
      : interpolate(scene.value, [0.08, 0.4], [0, 1], "clamp");
    return {
      opacity: t,
      transform: [{ translateY: (1 - t) * 14 }, { scale: 0.94 + t * 0.06 }],
    };
  });

  const replyStyle = useAnimatedStyle(() => {
    const t = reduced
      ? 1
      : interpolate(scene.value, [0.38, 0.7], [0, 1], "clamp");
    return {
      opacity: t,
      transform: [{ translateY: (1 - t) * 12 }, { scale: 0.94 + t * 0.06 }],
    };
  });

  return (
    <View style={styles.jumpStage} accessibilityLabel="Message a free friend">
      <Animated.View style={[styles.bubbleOut, bubbleStyle]}>
        <Text style={styles.bubbleText}>Want to grab coffee?</Text>
      </Animated.View>

      <Animated.View style={[styles.bubbleIn, replyStyle]}>
        <Text style={styles.bubbleTextDark}>Let&apos;s do it!</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  goLive: {
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
  },
  moodPill: {
    width: "100%",
    minHeight: 44,
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: MUTED3,
    backgroundColor: SURFACE_FAINT,
    borderRadius: RADIUS_MD,
    paddingHorizontal: 16,
    marginBottom: 18,
  },
  moodText: {
    color: MUTED3,
    fontSize: TYPE_BUTTON,
    fontFamily: fonts.book,
  },
  pulse: {
    width: 220,
    height: 220,
  },
  tapCta: {
    marginTop: 4,
    color: MUTED2,
    fontSize: TYPE_CAPTION,
    fontFamily: fonts.medium,
    letterSpacing: 1.3,
  },
  freeStage: {
    width: "100%",
    maxWidth: 320,
  },
  youRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 18,
    paddingHorizontal: 4,
  },
  youAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  youLetter: {
    color: ON_ACCENT_TEXT,
    fontFamily: fonts.heavy,
    fontSize: 14,
  },
  youLabel: {
    flex: 1,
    color: TEXT,
    fontFamily: fonts.medium,
    fontSize: TYPE_CAPTION,
  },
  youDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ACCENT,
  },
  freeList: {
    gap: 12,
  },
  freeCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: RADIUS_MD,
    borderWidth: 1,
    borderColor: "rgba(0,255,133,0.28)",
    backgroundColor: ACCENT_FILL_WHISPER,
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
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: ACCENT,
  },
  freeAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    fontSize: 16,
  },
  freeMemo: {
    marginTop: 2,
    color: MUTED2,
    fontFamily: fonts.book,
    fontSize: TYPE_CAPTION,
  },
  jumpStage: {
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
    paddingTop: 12,
  },
  bubbleOut: {
    alignSelf: "flex-start",
    marginLeft: 8,
    maxWidth: "86%",
    backgroundColor: SURFACE_FAINT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: MUTED3,
    borderRadius: 18,
    borderBottomLeftRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  bubbleIn: {
    alignSelf: "flex-end",
    marginRight: 8,
    maxWidth: "86%",
    backgroundColor: ACCENT,
    borderRadius: 18,
    borderBottomRightRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
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
