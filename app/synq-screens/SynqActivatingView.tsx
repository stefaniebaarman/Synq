import * as Haptics from "expo-haptics";
import React, { useEffect, useRef } from "react";
import { useReducedMotion } from "react-native-reanimated";
import SynqPulseStage, { LAUNCH_MS, RING_STAGGER_MS } from "./SynqPulseStage";

type Props = {
  onComplete: () => void;
};

export default function SynqActivatingView({ onComplete }: Props) {
  const reduced = useReducedMotion();
  const finished = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const finishLaunch = () => {
    if (finished.current) return;
    finished.current = true;
    onCompleteRef.current();
  };

  useEffect(() => {
    if (reduced) return;

    const hapticAt = [0, RING_STAGGER_MS, RING_STAGGER_MS * 2, RING_STAGGER_MS * 3];
    const hapticStyles = [
      Haptics.ImpactFeedbackStyle.Light,
      Haptics.ImpactFeedbackStyle.Light,
      Haptics.ImpactFeedbackStyle.Medium,
      Haptics.ImpactFeedbackStyle.Heavy,
    ] as const;
    const hapticTimers = hapticAt.map((ms, i) =>
      setTimeout(() => {
        Haptics.impactAsync(hapticStyles[i]).catch(() => {});
      }, ms)
    );

    const successTimer = setTimeout(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {}
      );
    }, reduced ? 480 : LAUNCH_MS);

    return () => {
      hapticTimers.forEach(clearTimeout);
      clearTimeout(successTimer);
    };
  }, [reduced]);

  return <SynqPulseStage onComplete={finishLaunch} />;
}
