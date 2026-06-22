import {
  BG,
  SHADOW,
} from "@/constants/Variables";
import React, { useLayoutEffect, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanimated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

export type MessagesPane = "inbox" | "chat" | "profile";

const PANE_DEPTH: Record<MessagesPane, number> = {
  inbox: 0,
  chat: 1,
  profile: 2,
};

/** UIKit UINavigationController default push/pop duration. */
export const MESSAGES_STACK_DURATION_MS = 350;
/** Matches iOS horizontal stack parallax (previous screen keeps ~30% visible). */
const STACK_PARALLAX = 0.3;
const IOS_STACK_EASING = Easing.bezier(0.32, 0.72, 0, 1);

type Props = {
  pane: MessagesPane;
  visible: boolean;
  width: number;
  inbox: React.ReactNode;
  chat?: React.ReactNode;
  profile?: React.ReactNode;
  onInteractivePop?: () => void;
};

export default function MessagesModalStack({
  pane,
  visible,
  width,
  inbox,
  chat,
  profile,
  onInteractivePop,
}: Props) {
  const stackDepth = useSharedValue(0);
  const dragStartDepth = useSharedValue(0);
  const targetDepth = useSharedValue(0);
  const [chatMounted, setChatMounted] = useState(false);
  const [profileMounted, setProfileMounted] = useState(false);

  const animateToDepth = (depth: number) => {
    "worklet";
    stackDepth.value = withTiming(depth, {
      duration: MESSAGES_STACK_DURATION_MS,
      easing: IOS_STACK_EASING,
    });
  };

  const finishInteractivePop = () => {
    onInteractivePop?.();
  };

  const edgePopGesture = Gesture.Pan()
    .activeOffsetX(12)
    .failOffsetY([-14, 14])
    .onStart(() => {
      dragStartDepth.value = stackDepth.value;
    })
    .onUpdate((event) => {
      const depthDelta = event.translationX / width;
      stackDepth.value = Math.max(
        0,
        Math.min(2, dragStartDepth.value - depthDelta)
      );
    })
    .onEnd((event) => {
      const target = targetDepth.value;
      if (target <= 0) {
        animateToDepth(0);
        return;
      }

      const shouldPop =
        event.translationX > width * 0.33 ||
        (event.velocityX > 850 && event.translationX > 24);

      if (shouldPop) {
        runOnJS(finishInteractivePop)();
        return;
      }

      animateToDepth(target);
    });

  useLayoutEffect(() => {
    if (!visible) {
      stackDepth.value = 0;
      setChatMounted(false);
      setProfileMounted(false);
      return;
    }

    const depth = PANE_DEPTH[pane];
    targetDepth.value = depth;
    if (depth >= 1) {
      setChatMounted(true);
    }
    if (depth >= 2) {
      setProfileMounted(true);
    }

    stackDepth.value = withTiming(depth, {
      duration: MESSAGES_STACK_DURATION_MS,
      easing: IOS_STACK_EASING,
    });

    if (depth === 0) {
      const timer = setTimeout(() => {
        setChatMounted(false);
        setProfileMounted(false);
      }, MESSAGES_STACK_DURATION_MS + 32);
      return () => clearTimeout(timer);
    }
  }, [visible, pane, stackDepth]);

  const inboxStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -stackDepth.value * width * STACK_PARALLAX }],
  }));

  const chatStyle = useAnimatedStyle(() => {
    const depth = stackDepth.value;
    const translateX =
      depth <= 1
        ? (1 - depth) * width
        : -(depth - 1) * width * STACK_PARALLAX;
    return { transform: [{ translateX }] };
  });

  const profileStyle = useAnimatedStyle(() => {
    const depth = stackDepth.value;
    const translateX = Math.max(0, 2 - depth) * width;
    return { transform: [{ translateX }] };
  });

  return (
    <View style={styles.root}>
      <Reanimated.View
        style={[styles.layer, inboxStyle]}
        pointerEvents={pane === "inbox" ? "auto" : "none"}
      >
        {inbox}
      </Reanimated.View>

      {chatMounted && chat ? (
        <Reanimated.View
          style={[styles.layer, styles.chatLayer, chatStyle, styles.stackShadow]}
          pointerEvents={pane === "chat" ? "auto" : "none"}
        >
          {chat}
        </Reanimated.View>
      ) : null}

      {profileMounted && profile ? (
        <Reanimated.View
          style={[
            styles.layer,
            styles.profileLayer,
            profileStyle,
            styles.stackShadow,
          ]}
          pointerEvents={pane === "profile" ? "auto" : "none"}
        >
          {profile}
        </Reanimated.View>
      ) : null}

      {(pane === "chat" || pane === "profile") && onInteractivePop ? (
        <GestureDetector gesture={edgePopGesture}>
          <View style={styles.edgeSwipeStrip} />
        </GestureDetector>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: BG,
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG,
  },
  chatLayer: {
    zIndex: 1,
  },
  profileLayer: {
    zIndex: 2,
  },
  stackShadow: Platform.select({
    ios: {
      shadowColor: SHADOW,
      shadowOffset: { width: -3, height: 0 },
      shadowOpacity: 0.22,
      shadowRadius: 10,
    },
    android: {
      elevation: 10,
    },
    default: {},
  }),
  edgeSwipeStrip: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 28,
    zIndex: 10,
  },
});
