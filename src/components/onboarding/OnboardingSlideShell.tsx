import {
  ACCENT,
  BG,
} from "@/constants/Variables";
import { router } from "expo-router";
import { useRef, type ReactNode } from "react";
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  PanGestureHandler,
  State,
  type PanGestureHandlerGestureEvent,
} from "react-native-gesture-handler";

import {
  ONBOARDING_CAROUSEL_STEPS,
  ONBOARDING_H_PADDING,
  ONBOARDING_SWIPE_DISTANCE,
  ONBOARDING_SWIPE_VELOCITY,
  onboardingCarouselStyles,
} from "@/constants/onboardingLayout";

type Props = {
  step: number;
  totalSteps?: number;
  title: string;
  subtitle: string;
  titleAccent?: string;
  ctaLabel: string;
  onNext: () => void;
  onBack?: () => void;
  onSkip?: () => void;
  children: ReactNode;
};

export default function OnboardingSlideShell({
  step,
  totalSteps = ONBOARDING_CAROUSEL_STEPS,
  title,
  subtitle,
  titleAccent,
  ctaLabel,
  onNext,
  onBack,
  onSkip,
  children,
}: Props) {
  const locked = useRef(false);

  const handleSkip = () =>
    onSkip ? onSkip() : router.push("/(auth)/getting-started");

  const onPanStateChange = (e: PanGestureHandlerGestureEvent) => {
    const { state, translationX, velocityX } = e.nativeEvent;
    if (state === State.BEGAN) locked.current = false;
    if (state !== State.END || locked.current) return;

    if (
      translationX < -ONBOARDING_SWIPE_DISTANCE ||
      velocityX < -ONBOARDING_SWIPE_VELOCITY
    ) {
      locked.current = true;
      if (step < totalSteps) onNext();
      return;
    }

    if (
      translationX > ONBOARDING_SWIPE_DISTANCE ||
      velocityX > ONBOARDING_SWIPE_VELOCITY
    ) {
      locked.current = true;
      if (step > 1) (onBack ? onBack() : router.back());
    }
  };

  return (
    <PanGestureHandler
      onHandlerStateChange={onPanStateChange}
      activeOffsetX={[-15, 15]}
      failOffsetY={[-15, 15]}
    >
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" />
        <View style={styles.container}>
          <TouchableOpacity
            onPress={handleSkip}
            activeOpacity={0.7}
            style={onboardingCarouselStyles.skip}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Skip onboarding"
          >
            <Text style={onboardingCarouselStyles.skipText}>Skip</Text>
          </TouchableOpacity>

          <View style={[onboardingCarouselStyles.topCopy, styles.topPad]}>
            <Text style={onboardingCarouselStyles.title}>
              {title}
              {titleAccent ? (
                <Text style={styles.titleAccent}>{titleAccent}</Text>
              ) : null}
            </Text>
            <Text style={onboardingCarouselStyles.sub}>{subtitle}</Text>
          </View>

          <View style={styles.hero}>{children}</View>

          <View style={onboardingCarouselStyles.bottom}>
            <TouchableOpacity
              onPress={onNext}
              activeOpacity={0.85}
              style={onboardingCarouselStyles.nextBtn}
              accessibilityRole="button"
              accessibilityLabel={ctaLabel}
            >
              <Text style={onboardingCarouselStyles.nextText}>{ctaLabel}</Text>
            </TouchableOpacity>

            <View
              style={onboardingCarouselStyles.dots}
              accessibilityLabel={`Step ${step} of ${totalSteps}`}
            >
              {Array.from({ length: totalSteps }).map((_, i) => {
                const active = i + 1 === step;
                return (
                  <View
                    key={i}
                    style={[
                      onboardingCarouselStyles.dot,
                      active
                        ? onboardingCarouselStyles.dotActive
                        : onboardingCarouselStyles.dotInactive,
                    ]}
                  />
                );
              })}
            </View>
          </View>
        </View>
      </SafeAreaView>
    </PanGestureHandler>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  topPad: {
    paddingHorizontal: ONBOARDING_H_PADDING,
  },
  titleAccent: {
    color: ACCENT,
  },
  hero: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: ONBOARDING_H_PADDING,
  },
});
