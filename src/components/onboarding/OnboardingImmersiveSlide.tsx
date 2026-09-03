import {
  ACCENT,
  BG,
  MUTED,
  MUTED2,
  MUTED3,
  TEXT,
  TYPE_BODY,
  TYPE_DISPLAY,
  TYPE_FINE,
  fonts,
} from "@/constants/Variables";
import {
  ONBOARDING_CAROUSEL_STEPS,
  ONBOARDING_HERO_TOP,
  ONBOARDING_HERO_WIDTH,
  ONBOARDING_H_PADDING,
  ONBOARDING_SWIPE_DISTANCE,
  ONBOARDING_SWIPE_VELOCITY,
} from "@/constants/onboardingLayout";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useRef, type ReactNode } from "react";
import {
  Platform,
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
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

type Props = {
  step: number;
  totalSteps?: number;
  kicker?: string;
  title: string;
  titleAccent?: string;
  subtitle: string;
  ctaLabel: string;
  onNext: () => void;
  onBack?: () => void;
  onSkip?: () => void;
  /** Override default hero top inset (taller lists need less). */
  heroTop?: number;
  children: ReactNode;
};

export default function OnboardingImmersiveSlide({
  step,
  totalSteps = ONBOARDING_CAROUSEL_STEPS,
  kicker = "SYNQ",
  title,
  titleAccent,
  subtitle,
  ctaLabel,
  onNext,
  onBack,
  onSkip,
  heroTop = ONBOARDING_HERO_TOP,
  children,
}: Props) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const locked = useRef(false);
  const enter = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) return;
    enter.value = withTiming(1, {
      duration: 700,
      easing: Easing.out(Easing.cubic),
    });
  }, [enter, reduced]);

  const copyStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 18 }],
  }));

  const heroStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
  }));

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
      <SafeAreaView style={styles.safe} edges={["bottom", "left", "right"]}>
        <StatusBar
          barStyle="light-content"
          backgroundColor={BG}
          translucent={Platform.OS === "android"}
        />
        <View style={styles.root}>
          <TouchableOpacity
            onPress={handleSkip}
            activeOpacity={0.7}
            style={[styles.skip, { top: insets.top + (Platform.OS === "android" ? 6 : 8) }]}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Skip onboarding"
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>

          <View style={[styles.stage, { paddingTop: heroTop }]} pointerEvents="none">
            <Animated.View style={[styles.hero, heroStyle]}>
              {children}
            </Animated.View>
            <LinearGradient
              colors={[
                "rgba(9,10,11,0.72)",
                "transparent",
                "rgba(9,10,11,0.9)",
              ]}
              locations={[0, 0.38, 1]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
          </View>

          <Animated.View style={[styles.copy, copyStyle]}>
            <Text style={styles.kicker}>{kicker}</Text>
            <Text style={styles.title}>
              {title}
              {titleAccent ? (
                <Text style={styles.titleAccent}>{titleAccent}</Text>
              ) : null}
            </Text>
            <Text style={styles.sub}>{subtitle}</Text>

            <View style={styles.footer}>
              <View
                style={styles.dots}
                accessibilityLabel={`Step ${step} of ${totalSteps}`}
              >
                {Array.from({ length: totalSteps }).map((_, i) => {
                  const active = i + 1 === step;
                  return (
                    <View
                      key={i}
                      style={[
                        styles.dot,
                        active ? styles.dotActive : styles.dotIdle,
                      ]}
                    />
                  );
                })}
              </View>

              <TouchableOpacity
                onPress={onNext}
                activeOpacity={0.8}
                style={styles.nextHit}
                accessibilityRole="button"
                accessibilityLabel={ctaLabel}
              >
                <Text style={styles.nextText}>{ctaLabel}</Text>
                <Ionicons name="chevron-forward" size={18} color={ACCENT} />
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </SafeAreaView>
    </PanGestureHandler>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG,
  },
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  skip: {
    position: "absolute",
    right: 18,
    zIndex: 10,
    paddingVertical: 4,
    paddingLeft: 8,
  },
  skipText: {
    color: MUTED2,
    fontFamily: fonts.book,
    fontSize: TYPE_BODY,
    lineHeight: TYPE_BODY + 6,
    ...(Platform.OS === "android" ? { includeFontPadding: false } : null),
  },
  stage: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
  },
  hero: {
    width: ONBOARDING_HERO_WIDTH,
    alignItems: "center",
  },
  copy: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: ONBOARDING_H_PADDING,
    paddingBottom: 72,
  },
  kicker: {
    color: ACCENT,
    fontFamily: fonts.heavy,
    fontSize: TYPE_FINE,
    letterSpacing: 2.4,
    marginBottom: 12,
  },
  title: {
    color: TEXT,
    fontFamily: fonts.heavy,
    fontSize: TYPE_DISPLAY + 4,
    letterSpacing: -0.6,
    lineHeight: 44,
    // Two-line titles on every carousel slide — keeps SYNQ kicker Y-aligned.
    minHeight: 88,
  },
  titleAccent: {
    color: ACCENT,
  },
  sub: {
    marginTop: 14,
    color: MUTED,
    fontFamily: fonts.book,
    fontSize: TYPE_BODY,
    lineHeight: 23,
    maxWidth: 320,
    // Reserve two lines so shorter copy doesn't drop the kicker.
    minHeight: 46,
  },
  footer: {
    marginTop: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dots: {
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 99,
  },
  dotIdle: {
    backgroundColor: MUTED3,
  },
  dotActive: {
    width: 18,
    backgroundColor: ACCENT,
  },
  nextHit: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingVertical: 10,
    paddingLeft: 14,
  },
  nextText: {
    color: ACCENT,
    fontFamily: fonts.medium,
    fontSize: TYPE_BODY,
    letterSpacing: 0.2,
  },
});
