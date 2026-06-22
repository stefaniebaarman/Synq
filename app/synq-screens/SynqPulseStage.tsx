import {
  ACCENT,
  ACCENT_BORDER,
  ACCENT_FILL_STRONG,
  BG,
  MUTED,
  TYPE_MODAL_TITLE,
  fonts,
  synqSvg,
} from "@/constants/Variables";
import { Image as ExpoImage } from "expo-image";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SvgXml } from "react-native-svg";

const RING_COUNT = 4;
const RING_STAGGER_MS = 420;
const RING_DURATION_MS = 1180;
const LAST_RING_END_MS =
  (RING_COUNT - 1) * RING_STAGGER_MS + RING_DURATION_MS;
const LAUNCH_MS = Math.max(2680, LAST_RING_END_MS + 260);
const CONTINUOUS_RING_CYCLE_MS = LAST_RING_END_MS + 320;

type Props = {
  title?: string;
  /** Launch choreography; calls once when the sequence finishes. */
  onComplete?: () => void;
};

function SonarRing({
  index,
  disabled,
  cycleKey,
}: {
  index: number;
  disabled: boolean;
  cycleKey: number;
}) {
  const scale = useSharedValue(0.55);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (disabled) return;
    const delay = index * RING_STAGGER_MS;
    scale.value = 0.55;
    opacity.value = 0.44;
    scale.value = withDelay(
      delay,
      withTiming(2.7, {
        duration: RING_DURATION_MS,
        easing: Easing.out(Easing.cubic),
      })
    );
    opacity.value = withDelay(
      delay,
      withTiming(0, {
        duration: RING_DURATION_MS,
        easing: Easing.out(Easing.quad),
      })
    );
  }, [disabled, index, opacity, scale, cycleKey]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.ring, ringStyle]} pointerEvents="none" />;
}

export default function SynqPulseStage({ title, onComplete }: Props) {
  const reduced = useReducedMotion();
  const launch = onComplete != null;
  const [ringCycle, setRingCycle] = useState(0);

  const bloom = useSharedValue(0);
  const bgReveal = useSharedValue(0);
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    if (launch) {
      const duration = reduced ? 480 : LAUNCH_MS;

      if (!reduced) {
        bloom.value = withTiming(1, {
          duration: LAUNCH_MS - 180,
          easing: Easing.inOut(Easing.cubic),
        });
        bgReveal.value = withTiming(1, {
          duration: LAUNCH_MS,
          easing: Easing.out(Easing.cubic),
        });
        pulseScale.value = withSequence(
          withTiming(1.06, { duration: 360, easing: Easing.out(Easing.cubic) }),
          withTiming(1, {
            duration: LAUNCH_MS - 360,
            easing: Easing.inOut(Easing.cubic),
          })
        );
      }

      const completeTimer = setTimeout(() => {
        onComplete?.();
      }, duration);

      return () => clearTimeout(completeTimer);
    }

    if (reduced) return;

    bloom.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.cubic) }),
        withTiming(0.35, { duration: 1400, easing: Easing.inOut(Easing.cubic) })
      ),
      -1,
      false
    );
    bgReveal.value = withTiming(1, {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    });
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 720, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 720, easing: Easing.inOut(Easing.cubic) })
      ),
      -1,
      false
    );

    const ringTimer = setInterval(() => {
      setRingCycle((c) => c + 1);
    }, CONTINUOUS_RING_CYCLE_MS);

    return () => clearInterval(ringTimer);
  }, [launch, reduced, bloom, bgReveal, pulseScale, onComplete]);

  const bloomStyle = useAnimatedStyle(() => ({
    opacity: 0.12 + bloom.value * 0.38,
    transform: [{ scale: 0.85 + bloom.value * 0.35 }],
  }));

  const bgStyle = useAnimatedStyle(() => ({
    opacity: 0.06 + bgReveal.value * 0.2,
    transform: [
      { scale: launch ? 0.9 + bgReveal.value * 0.14 : 0.94 },
    ],
  }));

  const bgTintStyle = useAnimatedStyle(() => ({
    opacity: bgReveal.value * 0.12,
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.bgWrap, bgStyle]} pointerEvents="none">
        <SvgXml xml={synqSvg} width="115%" height="115%" />
      </Animated.View>
      <Animated.View style={[styles.bgTint, bgTintStyle]} pointerEvents="none" />

      <View style={styles.stage}>
        <View style={styles.pulseArea}>
          {Array.from({ length: RING_COUNT }, (_, i) => (
            <SonarRing
              key={`${ringCycle}-${i}`}
              index={i}
              disabled={reduced}
              cycleKey={ringCycle}
            />
          ))}
          <Animated.View style={[styles.pulseGlow, bloomStyle]} pointerEvents="none" />
          <Animated.View style={pulseStyle}>
            <ExpoImage
              source={require("../../assets/pulse.gif")}
              style={styles.pulseGif}
              contentFit="contain"
              transition={0}
              cachePolicy="memory-disk"
            />
          </Animated.View>
        </View>
        {title ? <Text style={styles.title}>{title}</Text> : null}
      </View>
    </View>
  );
}

const PULSE_SIZE = 252;
const STAGE = 300;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  bgWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  bgTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: ACCENT,
  },
  stage: {
    alignItems: "center",
    justifyContent: "center",
  },
  pulseArea: {
    width: STAGE,
    height: STAGE,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    width: PULSE_SIZE,
    height: PULSE_SIZE,
    borderRadius: PULSE_SIZE / 2,
    borderWidth: 2,
    borderColor: ACCENT_BORDER,
  },
  pulseGlow: {
    position: "absolute",
    width: PULSE_SIZE + 28,
    height: PULSE_SIZE + 28,
    borderRadius: (PULSE_SIZE + 28) / 2,
    backgroundColor: ACCENT_FILL_STRONG,
  },
  pulseGif: {
    width: PULSE_SIZE,
    height: PULSE_SIZE,
  },
  title: {
    marginTop: 28,
    color: MUTED,
    fontSize: TYPE_MODAL_TITLE,
    fontFamily: fonts.heavy,
    letterSpacing: 0.2,
  },
});

export { LAUNCH_MS, RING_STAGGER_MS };
