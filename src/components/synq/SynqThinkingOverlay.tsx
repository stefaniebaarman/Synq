import {
  ACCENT,
  TYPE_BODY,
  fonts,
} from "@/constants/Variables";
import { Image as ExpoImage } from "expo-image";
import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const PULSE_SIZE = 200;
const ORB_STAGE = 260;
const IDLE_RING_COUNT = 2;
const IDLE_RING_CYCLE_MS = 4000;
const IDLE_RING_STAGGER_MS = 1400;

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

function SynqPulseOrb() {
  const reduced = useReducedMotion();
  const breathe = useSharedValue(1);
  const glow = useSharedValue(0.28);

  useEffect(() => {
    if (reduced) return;
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
  }, [breathe, glow, reduced]);

  const haloFar = useAnimatedStyle(() => ({
    transform: [{ scale: breathe.value * 1.08 }],
    opacity: glow.value * 0.45,
  }));
  const haloNear = useAnimatedStyle(() => ({
    transform: [{ scale: 0.97 + (breathe.value - 1) * 2 }],
    opacity: 0.12 + glow.value * 0.35,
  }));

  return (
    <View style={styles.orbStage}>
      {Array.from({ length: IDLE_RING_COUNT }, (_, i) => (
        <IdleSonarRing key={i} index={i} disabled={reduced} />
      ))}
      <Animated.View style={[styles.orbHaloFar, haloFar]} pointerEvents="none" />
      <Animated.View style={[styles.orbHaloNear, haloNear]} pointerEvents="none" />
      <View style={styles.orbHaloCore} pointerEvents="none" />
      <View style={styles.orbRingOuter} pointerEvents="none" />
      <OrbEdgeShimmer disabled={reduced} />
      <View style={styles.orbRingInner} pointerEvents="none" />
      <ExpoImage
        source={require("../../../assets/pulse.gif")}
        style={styles.orbLogo}
        contentFit="contain"
        transition={0}
        cachePolicy="memory-disk"
      />
    </View>
  );
}

type Props = {
  visible: boolean;
  label?: string;
};

export default function SynqThinkingOverlay({
  visible,
  label = "Finding the move…",
}: Props) {
  const reduced = useReducedMotion();
  const labelGlow = useSharedValue(0.78);

  useEffect(() => {
    if (!visible || reduced) return;
    labelGlow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.78, { duration: 2800, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  }, [labelGlow, reduced, visible]);

  const labelStyle = useAnimatedStyle(() => ({
    opacity: reduced ? 0.85 : labelGlow.value,
  }));

  if (!visible) return null;

  const enter = reduced ? FadeIn.duration(1) : FadeIn.duration(280);

  return (
    <Animated.View entering={enter} style={styles.overlay} pointerEvents="box-none">
      <SynqPulseOrb />
      <Animated.Text style={[styles.label, labelStyle]}>{label}</Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2000,
    backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  label: {
    color: "rgba(255,255,255,0.75)",
    fontSize: TYPE_BODY,
    fontFamily: fonts.medium,
    letterSpacing: 0.3,
    marginTop: 4,
  },
  orbStage: {
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
    borderColor: "rgba(0,255,133,0.2)",
  },
  orbHaloFar: {
    position: "absolute",
    width: PULSE_SIZE + 36,
    height: PULSE_SIZE + 36,
    borderRadius: (PULSE_SIZE + 36) / 2,
    backgroundColor: "rgba(0,255,133,0.03)",
  },
  orbHaloNear: {
    position: "absolute",
    width: PULSE_SIZE + 16,
    height: PULSE_SIZE + 16,
    borderRadius: (PULSE_SIZE + 16) / 2,
    backgroundColor: "rgba(0,255,133,0.05)",
  },
  orbHaloCore: {
    position: "absolute",
    width: PULSE_SIZE + 4,
    height: PULSE_SIZE + 4,
    borderRadius: (PULSE_SIZE + 4) / 2,
    backgroundColor: "rgba(0,255,133,0.02)",
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
    borderColor: "rgba(0,255,133,0.1)",
  },
  orbRingShimmer: {
    position: "absolute",
    width: PULSE_SIZE + 2,
    height: PULSE_SIZE + 2,
    borderRadius: (PULSE_SIZE + 2) / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,255,133,0.32)",
  },
  orbRingInner: {
    position: "absolute",
    width: PULSE_SIZE,
    height: PULSE_SIZE,
    borderRadius: PULSE_SIZE / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,255,133,0.16)",
  },
  orbLogo: {
    width: PULSE_SIZE,
    height: PULSE_SIZE,
  },
});
