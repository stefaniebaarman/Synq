import SynqAudienceSheet from "@/app/synq-screens/SynqAudienceSheet";
import {
  ACCENT,
  ACCENT_BORDER_MUTED,
  ACCENT_FILL_FAINT,
  ACCENT_FILL_MUTED,
  ACCENT_FILL_WHISPER,
  ACCENT_SUBTLE,
  BG,
  MUTED2,
  MUTED3,
  RADIUS_MD,
  SPACE_2,
  SPACE_3,
  SPACE_4,
  SPACE_5,
  SPACE_6,
  SURFACE_FAINT,
  SURFACE_MUTED,
  TAB_BAR_SCROLL_INSET,
  TEXT,
  TYPE_BODY,
  TYPE_BUTTON,
  TYPE_CAPTION,
  TYPE_TITLE,
  fonts,
} from "@/constants/Variables";
import type { FriendGroup } from "@/src/lib/friendGroups";
import { formatAudienceSelectionLabel, type SynqAudienceSelection } from "@/src/lib/synqBroadcast";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import React, { useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  memo: string;
  setMemo: (text: string) => void;
  onStartSynq: () => void;
  isStartingSynq?: boolean;
  friendGroups: FriendGroup[];
  audienceSelection: SynqAudienceSelection;
  onAudienceSelectionChange: (next: SynqAudienceSelection) => void;
};

const PULSE_SIZE = 238;
const ORB_STAGE = 312;
const CONTENT_W = 322;
const IDLE_RING_COUNT = 2;
const IDLE_RING_CYCLE_MS = 4000;
const IDLE_RING_STAGGER_MS = 1400;

const MOOD_HINTS = [
  "What are you down for?",
  "Drinks tonight?",
  "Let's grab coffee!",
  "Quick bite?",
  "Dinner and a catch-up?",
  "Movie night?",
  "Down for a night out",
  "Game night?",
  "Looking to go for a hike",
  "Try a new restaurant?",
];
const MOOD_HINT_INTERVAL_MS = 9000;

// ——— Mood hints ———

function SlowMoodPlaceholder({ active }: { active: boolean }) {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!active || reduced) return;
    const advance = () => setIndex((i) => (i + 1) % MOOD_HINTS.length);
    const id = setInterval(() => {
      opacity.value = withTiming(0, { duration: 600 }, (finished) => {
        if (finished) {
          runOnJS(advance)();
          opacity.value = withTiming(1, { duration: 720 });
        }
      });
    }, MOOD_HINT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [active, reduced, opacity]);

  const ghostStyle = useAnimatedStyle(() => ({ opacity: opacity.value * 0.92 }));

  if (!active) {
    if (reduced) {
      return (
        <Text style={styles.moodGhost} numberOfLines={1}>
          {MOOD_HINTS[0]}
        </Text>
      );
    }
    return null;
  }

  return (
    <Animated.Text pointerEvents="none" style={[styles.moodGhost, ghostStyle]} numberOfLines={1}>
      {MOOD_HINTS[index]}
    </Animated.Text>
  );
}

// ——— Orb effects ———

function IdleSonarRing({ index, disabled }: { index: number; disabled: boolean }) {
  const scale = useSharedValue(0.84);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (disabled) return;
    const delay = index * IDLE_RING_STAGGER_MS;
    const loopMs = IDLE_RING_CYCLE_MS + (IDLE_RING_COUNT - 1) * IDLE_RING_STAGGER_MS;

    const runCycle = () => {
      scale.value = 0.84;
      opacity.value = 0.14;
      scale.value = withDelay(
        delay,
        withTiming(1.52, { duration: IDLE_RING_CYCLE_MS, easing: Easing.out(Easing.cubic) })
      );
      opacity.value = withDelay(
        delay,
        withTiming(0, { duration: IDLE_RING_CYCLE_MS, easing: Easing.out(Easing.quad) })
      );
    };

    runCycle();
    const id = setInterval(runCycle, loopMs);
    return () => clearInterval(id);
  }, [disabled, index, opacity, scale]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.idleRing, ringStyle]} pointerEvents="none" />;
}

function OrbEdgeShimmer({ disabled }: { disabled: boolean }) {
  const shimmer = useSharedValue(0.14);

  useEffect(() => {
    if (disabled) return;
    shimmer.value = withRepeat(
      withSequence(
        withTiming(0.34, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.12, { duration: 3200, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  }, [disabled, shimmer]);

  const style = useAnimatedStyle(() => ({ opacity: shimmer.value }));
  return <Animated.View style={[styles.orbRingShimmer, style]} pointerEvents="none" />;
}

function ActivationOrb({
  disabled,
  pressStyle,
  onPress,
  onPressIn,
  onPressOut,
  isStartingSynq,
}: {
  disabled: boolean;
  pressStyle: ReturnType<typeof useAnimatedStyle>;
  onPress: () => void;
  onPressIn: () => void;
  onPressOut: () => void;
  isStartingSynq: boolean;
}) {
  const reduced = useReducedMotion();
  const breathe = useSharedValue(1);
  const glow = useSharedValue(0.28);

  useEffect(() => {
    if (reduced || isStartingSynq) return;
    breathe.value = withRepeat(
      withSequence(
        withTiming(1.035, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
    glow.value = withRepeat(
      withSequence(
        withTiming(0.4, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.24, { duration: 3000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  }, [breathe, glow, isStartingSynq, reduced]);

  const haloFar = useAnimatedStyle(() => ({
    transform: [{ scale: breathe.value * 1.08 }],
    opacity: glow.value * 0.45,
  }));
  const haloNear = useAnimatedStyle(() => ({
    transform: [{ scale: 0.97 + (breathe.value - 1) * 2 }],
    opacity: 0.12 + glow.value * 0.35,
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      style={[styles.orbHit, pressStyle, isStartingSynq && styles.orbStarting]}
      accessibilityRole="button"
      accessibilityLabel={isStartingSynq ? "Activating Synq" : "Tap to activate Synq"}
    >
      {Array.from({ length: IDLE_RING_COUNT }, (_, i) => (
        <IdleSonarRing key={i} index={i} disabled={reduced || isStartingSynq} />
      ))}
      <Animated.View style={[styles.orbHaloFar, haloFar]} pointerEvents="none" />
      <Animated.View style={[styles.orbHaloNear, haloNear]} pointerEvents="none" />
      <View style={styles.orbHaloCore} pointerEvents="none" />
      <View style={styles.orbRingOuter} pointerEvents="none" />
      <OrbEdgeShimmer disabled={reduced || isStartingSynq} />
      <View style={styles.orbRingInner} pointerEvents="none" />
      <ExpoImage
        source={require("../../assets/pulse.gif")}
        style={styles.orbLogo}
        contentFit="contain"
        transition={0}
        cachePolicy="memory-disk"
      />
    </AnimatedPressable>
  );
}

// ——— Screen ———

export default function InactiveSynqView({
  memo,
  setMemo,
  onStartSynq,
  isStartingSynq = false,
  friendGroups,
  audienceSelection,
  onAudienceSelectionChange,
}: Props) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const pressScale = useSharedValue(1);
  const [audienceSheetOpen, setAudienceSheetOpen] = useState(false);
  const [memoFocused, setMemoFocused] = useState(false);
  const ctaGlow = useSharedValue(0.88);

  const audienceLabel = formatAudienceSelectionLabel(audienceSelection, friendGroups);
  const memoEmpty = memo.trim().length === 0;
  const showMoodHints = memoEmpty && !memoFocused;

  const bottomPad =
    TAB_BAR_SCROLL_INSET + SPACE_6 + (Platform.OS === "android" ? insets.bottom : 0);

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const ctaStyle = useAnimatedStyle(() => ({
    opacity: ctaGlow.value,
  }));

  useEffect(() => {
    if (reduced || isStartingSynq) return;
    ctaGlow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.78, { duration: 2800, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  }, [ctaGlow, isStartingSynq, reduced]);

  const handlePressIn = () => {
    if (isStartingSynq) return;
    pressScale.value = withSpring(0.95, { damping: 20, stiffness: 340 });
  };

  const handlePressOut = () => {
    pressScale.value = withSpring(1, { damping: 18, stiffness: 300 });
  };

  const handlePress = () => {
    if (isStartingSynq) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onStartSynq();
  };

  const openAudienceSheet = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setAudienceSheetOpen(true);
  };

  const enter = (delay: number) =>
    reduced ? FadeIn.duration(1) : FadeIn.delay(delay).duration(320);

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + SPACE_5,
            paddingBottom: bottomPad,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.compose}>
          <Animated.View entering={enter(0)} style={styles.stack}>
            <Text style={styles.title}>
              Let&apos;s <Text style={styles.titleAccent}>Synq.</Text>
            </Text>

            <Animated.View entering={enter(60)} style={styles.footer}>
              <View style={styles.moodPill}>
                <View style={styles.moodField}>
                  <SlowMoodPlaceholder active={showMoodHints} />
                  <TextInput
                    style={[styles.moodInput, showMoodHints && styles.moodInputGhost]}
                    value={memo}
                    onChangeText={setMemo}
                    onFocus={() => setMemoFocused(true)}
                    onBlur={() => setMemoFocused(false)}
                    placeholder=""
                    blurOnSubmit
                    returnKeyType="done"
                    accessibilityLabel="Mood or intention"
                    accessibilityHint="Optional. Friends see this while you're active."
                  />
                </View>
              </View>

              <Pressable
                onPress={openAudienceSheet}
                style={({ pressed }) => [styles.audiencePill, pressed && styles.audiencePillPressed]}
                accessibilityRole="button"
                accessibilityLabel={`Sharing with ${audienceLabel}`}
                accessibilityHint="Opens audience picker"
              >
                <Text style={styles.sharingLabel}>Sharing with</Text>
                <View style={styles.audienceValueRow}>
                  <Text style={styles.sharingValue} numberOfLines={1}>
                    {audienceLabel}
                  </Text>
                  <Ionicons name="chevron-down" size={15} color={MUTED2} />
                </View>
              </Pressable>
            </Animated.View>

            <View style={styles.stage}>
              <ActivationOrb
                disabled={isStartingSynq}
                pressStyle={pressStyle}
                onPress={handlePress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                isStartingSynq={isStartingSynq}
              />
            </View>

            <Pressable
              onPress={handlePress}
              disabled={isStartingSynq}
              hitSlop={{ top: 12, bottom: 16, left: 40, right: 40 }}
              style={styles.ctaBlock}
              accessibilityRole="button"
              accessibilityLabel={isStartingSynq ? "Activating Synq" : "Tap to activate Synq"}
            >
              <Animated.Text style={[styles.ctaText, ctaStyle]}>
                {isStartingSynq ? "ACTIVATING…" : "TAP TO ACTIVATE"}
              </Animated.Text>
            </Pressable>
          </Animated.View>
        </View>
      </ScrollView>

      <SynqAudienceSheet
        visible={audienceSheetOpen}
        groups={friendGroups}
        selection={audienceSelection}
        onChangeSelection={onAudienceSelectionChange}
        onClose={() => setAudienceSheetOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  scroll: {
    flex: 1,
    backgroundColor: "transparent",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACE_5,
  },
  compose: {
    flexGrow: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: SPACE_2,
  },
  stack: {
    width: CONTENT_W,
    maxWidth: "100%",
    alignItems: "center",
  },
  title: {
    color: TEXT,
    fontSize: TYPE_TITLE,
    lineHeight: 36,
    fontFamily: fonts.heavy,
    letterSpacing: -0.45,
    textAlign: "center",
    marginBottom: SPACE_6 + SPACE_4,
  },
  titleAccent: {
    color: ACCENT,
    fontFamily: fonts.heavy,
  },
  footer: {
    width: "100%",
    marginBottom: SPACE_3,
    alignItems: "center",
    paddingHorizontal: SPACE_2,
  },
  moodPill: {
    width: "100%",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: MUTED3,
    backgroundColor: SURFACE_FAINT,
    borderRadius: RADIUS_MD,
    paddingHorizontal: SPACE_4,
    paddingVertical: SPACE_2,
  },
  moodField: {
    width: "100%",
    minHeight: 30,
    justifyContent: "center",
    alignItems: "stretch",
  },
  moodGhost: {
    position: "absolute",
    left: 0,
    right: 0,
    color: MUTED3,
    fontSize: TYPE_BUTTON,
    lineHeight: 21,
    fontFamily: fonts.book,
    letterSpacing: 0.08,
    textAlign: "left",
  },
  moodInput: {
    width: "100%",
    color: TEXT,
    fontSize: TYPE_BODY,
    lineHeight: 22,
    fontFamily: fonts.book,
    letterSpacing: 0.1,
    textAlign: "left",
    padding: 0,
    margin: 0,
    minHeight: 28,
    backgroundColor: "transparent",
  },
  moodInputGhost: {
    color: "transparent",
  },
  audiencePill: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACE_3,
    marginTop: SPACE_3,
    paddingVertical: 13,
    paddingHorizontal: SPACE_4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: MUTED3,
    backgroundColor: SURFACE_FAINT,
    borderRadius: RADIUS_MD,
  },
  audiencePillPressed: {
    backgroundColor: SURFACE_MUTED,
  },
  audienceValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
    minWidth: 0,
    maxWidth: "62%",
    justifyContent: "flex-end",
  },
  sharingLabel: {
    color: MUTED3,
    fontSize: TYPE_BUTTON,
    lineHeight: 21,
    fontFamily: fonts.book,
    letterSpacing: 0.08,
    flexShrink: 0,
  },
  sharingValue: {
    flexShrink: 1,
    color: TEXT,
    fontSize: TYPE_BUTTON,
    lineHeight: 21,
    fontFamily: fonts.medium,
    letterSpacing: 0.02,
    textAlign: "right",
  },
  ctaBlock: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: SPACE_3,
    marginTop: -6,
  },
  ctaText: {
    color: MUTED2,
    fontSize: TYPE_CAPTION,
    lineHeight: 18,
    fontFamily: fonts.medium,
    letterSpacing: 1.2,
    textAlign: "center",
  },
  stage: {
    width: ORB_STAGE,
    height: ORB_STAGE,
    alignItems: "center",
    justifyContent: "center",
  },
  orbHit: {
    width: ORB_STAGE,
    height: ORB_STAGE,
    alignItems: "center",
    justifyContent: "center",
  },
  idleRing: {
    position: "absolute",
    width: PULSE_SIZE,
    height: PULSE_SIZE,
    borderRadius: PULSE_SIZE / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ACCENT_BORDER_MUTED,
  },
  orbHaloFar: {
    position: "absolute",
    width: PULSE_SIZE + 36,
    height: PULSE_SIZE + 36,
    borderRadius: (PULSE_SIZE + 36) / 2,
    backgroundColor: ACCENT_FILL_FAINT,
  },
  orbHaloNear: {
    position: "absolute",
    width: PULSE_SIZE + 16,
    height: PULSE_SIZE + 16,
    borderRadius: (PULSE_SIZE + 16) / 2,
    backgroundColor: ACCENT_FILL_MUTED,
  },
  orbHaloCore: {
    position: "absolute",
    width: PULSE_SIZE + 4,
    height: PULSE_SIZE + 4,
    borderRadius: (PULSE_SIZE + 4) / 2,
    backgroundColor: ACCENT_FILL_WHISPER,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 2,
  },
  orbRingOuter: {
    position: "absolute",
    width: PULSE_SIZE + 8,
    height: PULSE_SIZE + 8,
    borderRadius: (PULSE_SIZE + 8) / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ACCENT_BORDER_MUTED,
  },
  orbRingShimmer: {
    position: "absolute",
    width: PULSE_SIZE + 2,
    height: PULSE_SIZE + 2,
    borderRadius: (PULSE_SIZE + 2) / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ACCENT_SUBTLE,
  },
  orbRingInner: {
    position: "absolute",
    width: PULSE_SIZE,
    height: PULSE_SIZE,
    borderRadius: PULSE_SIZE / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ACCENT_BORDER_MUTED,
  },
  orbLogo: {
    width: PULSE_SIZE,
    height: PULSE_SIZE,
  },
  orbStarting: {
    opacity: 0.9,
  },
});
