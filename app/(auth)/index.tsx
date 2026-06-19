import {
  ACCENT,
  BG,
  BORDER,
  MUTED,
  PRIMARY_CTA_HEIGHT,
  PRIMARY_CTA_WIDTH,
  SURFACE,
  TEXT,
  TYPE_BODY,
  TYPE_CTA,
  TYPE_DISPLAY,
  fonts,
  synqSvg,
} from "@/constants/Variables";
import { Image as ExpoImage } from "expo-image";
import { router } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { PanGestureHandler, State } from "react-native-gesture-handler";
import { SvgXml } from "react-native-svg";


type Props = {
  onNext?: () => void;
  onPrev?: () => void;
  onSkip?: () => void;
  step?: number;
  totalSteps?: number;
};

export default function MakePlansScreen({
  onNext,
  onPrev,
  onSkip,
  step = 1,
  totalSteps = 4,
}: Props) {
  const topFade = useRef(new Animated.Value(0)).current;
  const orbFade = useRef(new Animated.Value(0)).current;
  const bottomFade = useRef(new Animated.Value(0)).current;
  const SWIPE_DISTANCE = 60;
  const SWIPE_VELOCITY = 700;
  const locked = useRef(false);

  const goNext = () => (onNext ? onNext() : router.push("/(auth)/welcome"));
  const goPrev = () => (onPrev ? onPrev() : router.back());

  const onPanStateChange = (e: any) => {
    const { state, translationX, velocityX } = e.nativeEvent;

    if (state === State.BEGAN) locked.current = false;

    if (state === State.END && !locked.current) {
      if (translationX < -SWIPE_DISTANCE || velocityX < -SWIPE_VELOCITY) {
        locked.current = true;
        if (step < totalSteps) goNext();
        return;
      }

      if (translationX > SWIPE_DISTANCE || velocityX > SWIPE_VELOCITY) {
        locked.current = true;
        if (step > 1) goPrev();
        return;
      }
    }
  };

  useEffect(() => {
    Animated.stagger(120, [
      Animated.timing(topFade, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(orbFade, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(bottomFade, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
  }, [topFade, orbFade, bottomFade]);

  return (
    <PanGestureHandler
      onHandlerStateChange={onPanStateChange}
      activeOffsetX={[-15, 15]}  
      failOffsetY={[-15, 15]} 
    >
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" />
        <View style={styles.container}>
          <View pointerEvents="none" style={styles.bgSvgWrap}>
            <SvgXml xml={synqSvg} width="120%" height="120%" />
          </View>

          <TouchableOpacity
            onPress={() => (onSkip ? onSkip() : router.push("/(auth)/getting-started"))}
            activeOpacity={0.7}
            style={styles.skip}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>

          <Animated.View style={[styles.topCopy, { opacity: topFade }]}>
            <Text style={styles.title}>Turn spare moments{"\n"}into shared ones.</Text>
            <View style={styles.divider} />
            <Text style={styles.sub}>
              A social tool that shows you which friends are free, right now.
            </Text>
          </Animated.View>

          <Animated.View style={[styles.orbWrap, { opacity: orbFade }]}>
            <ExpoImage
              source={require("../../assets/pulse.gif")}
              style={styles.orb}
              contentFit="contain"
              cachePolicy="memory-disk"
              transition={0}
            />
          </Animated.View>

          <Animated.View style={[styles.bottom, { opacity: bottomFade }]}>
            <TouchableOpacity
              onPress={goNext}
              activeOpacity={0.85}
              style={styles.nextBtn}
            >
              <Text style={styles.nextText}>Next</Text>
            </TouchableOpacity>

            <View style={styles.dots} accessibilityLabel={`Step ${step} of ${totalSteps}`}>
              {Array.from({ length: totalSteps }).map((_, i) => {
                const active = i + 1 === step;
                return (
                  <View
                    key={i}
                    style={[styles.dot, active ? styles.dotActive : styles.dotInactive]}
                  />
                );
              })}
            </View>
          </Animated.View>
        </View>
      </SafeAreaView>
    </PanGestureHandler>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  container: { flex: 1, backgroundColor: BG, paddingHorizontal: 22 },
  bgSvgWrap: {
    position: "absolute",
    top: -40,
    left: -40,
    right: -40,
    bottom: -40,
    opacity: 0.3,
    transform: [{ rotate: "-8deg" }],
  },
  skip: { position: "absolute", top: 14, right: 18, zIndex: 10 },
  skipText: {
    color: MUTED,
    fontFamily: fonts.book,
    fontSize: TYPE_BODY,
  },
  topCopy: { paddingTop: 86 },
  title: {
    color: TEXT,
    fontFamily: fonts.heavy,
    fontSize: TYPE_DISPLAY,
    letterSpacing: 0.2,
    lineHeight: 40,
  },
  divider: {
    marginTop: 14,
    height: 1,
    backgroundColor: BORDER,
    width: "78%",
  },
  sub: {
    marginTop: 16,
    color: MUTED,
    fontFamily: fonts.medium,
    fontSize: TYPE_BODY,
    lineHeight: 22,
  },
  orbWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  orb: {
    width: 320,
    height: 320,
    opacity: 0.98,
  },
  bottom: {
    paddingBottom: 26,
    alignItems: "center",
  },
  nextBtn: {
    width: PRIMARY_CTA_WIDTH,
    height: PRIMARY_CTA_HEIGHT,
    borderRadius: 14,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    justifyContent: "center",
    alignItems: "center",
  },
  nextText: {
    color: ACCENT,
    fontFamily: fonts.heavy,
    fontSize: TYPE_CTA,
    letterSpacing: 0.2,
  },
  dots: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: { width: 7, height: 7, borderRadius: 99 },
  dotInactive: { backgroundColor: "rgba(255,255,255,0.18)" },
  dotActive: { backgroundColor: ACCENT },
});
