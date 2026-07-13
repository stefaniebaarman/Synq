import { sheetStyles } from "@/constants/sheetStyles";
import { SHEET_OVERLAY } from "@/constants/Variables";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const SHEET_SPRING = { damping: 30, stiffness: 300, mass: 0.95 };
const SHEET_CLOSE_MS = 280;
const DISMISS_DISTANCE = 96;
const DISMISS_VELOCITY = 1100;

type Props = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Horizontal inset + bottom padding around the sheet stack. */
  contentStyle?: StyleProp<ViewStyle>;
  /** When set, children render inside a card with a drag grabber. */
  cardStyle?: StyleProp<ViewStyle>;
  /** Content below the card (e.g. Cancel). */
  footer?: React.ReactNode;
  /** Content above the card (e.g. sheet kicker). */
  header?: React.ReactNode;
  /** Enable grabber + drag-to-dismiss. Default true. */
  grabber?: boolean;
  /**
   * `modal` — RN Modal (default).
   * `embedded` — absolute overlay for sheets already inside another modal.
   */
  presentation?: "modal" | "embedded";
  /** Optional layer above the sheet (e.g. embedded ConfirmModal). */
  overlay?: React.ReactNode;
  /** Backdrop press handler. Defaults to onClose. */
  onBackdropPress?: () => void;
  /** Fires after the sheet has fully unmounted (safe to open another Modal). */
  onClosed?: () => void;
};

/**
 * Bottom sheet with spring present, timed dismiss, backdrop fade,
 * and grabber drag-to-dismiss. Respects Reduce Motion.
 */
export default function SpringBottomSheet({
  visible,
  onClose,
  children,
  contentStyle,
  cardStyle,
  footer,
  header,
  grabber = true,
  presentation = "modal",
  onBackdropPress,
  onClosed,
  overlay,
}: Props) {
  const reducedMotion = useReducedMotion();
  const translateY = useSharedValue(9999);
  const overlayOpacity = useSharedValue(0);
  const sheetHeightRef = useRef(0);
  const closingRef = useRef(false);
  const wasMountedRef = useRef(visible);
  const onClosedRef = useRef(onClosed);
  const [mounted, setMounted] = useState(visible);
  const handleBackdrop = onBackdropPress ?? onClose;
  onClosedRef.current = onClosed;

  const openSheet = useCallback(() => {
    closingRef.current = false;
    cancelAnimation(translateY);
    cancelAnimation(overlayOpacity);
    if (reducedMotion) {
      translateY.value = 0;
      overlayOpacity.value = 1;
      return;
    }
    overlayOpacity.value = withTiming(1, { duration: 180 });
    translateY.value = withSpring(0, SHEET_SPRING);
  }, [overlayOpacity, reducedMotion, translateY]);

  const finishClose = useCallback(() => {
    closingRef.current = false;
    setMounted(false);
  }, []);

  // After the RN Modal unmounts, run onClosed so follow-up Modals can present.
  useEffect(() => {
    if (mounted) {
      wasMountedRef.current = true;
      return;
    }
    if (!wasMountedRef.current) return;
    wasMountedRef.current = false;
    onClosedRef.current?.();
  }, [mounted]);

  const closeSheet = useCallback(
    (notifyParent: boolean) => {
      if (closingRef.current) return;
      closingRef.current = true;
      const h = Math.max(sheetHeightRef.current, 1);
      cancelAnimation(translateY);
      cancelAnimation(overlayOpacity);
      if (reducedMotion) {
        translateY.value = h;
        overlayOpacity.value = 0;
        finishClose();
        if (notifyParent) onClose();
        return;
      }
      overlayOpacity.value = withTiming(0, { duration: SHEET_CLOSE_MS });
      translateY.value = withTiming(
        h,
        { duration: SHEET_CLOSE_MS, easing: Easing.inOut(Easing.cubic) },
        (finished) => {
          if (finished) {
            runOnJS(finishClose)();
            if (notifyParent) runOnJS(onClose)();
          }
        }
      );
    },
    [finishClose, onClose, overlayOpacity, reducedMotion, translateY]
  );

  const onSheetLayout = useCallback(
    (height: number) => {
      if (height <= 0) return;
      const prev = sheetHeightRef.current;
      sheetHeightRef.current = height;
      if (!visible) {
        translateY.value = height;
        return;
      }
      if (prev <= 0) {
        translateY.value = height;
        openSheet();
      }
    },
    [openSheet, translateY, visible]
  );

  useEffect(() => {
    if (visible) {
      setMounted(true);
      if (sheetHeightRef.current > 0) openSheet();
      return;
    }
    if (!mounted) return;
    closeSheet(false);
  }, [visible, mounted, openSheet, closeSheet]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const pan = Gesture.Pan()
    .enabled(grabber && !reducedMotion)
    .activeOffsetY(8)
    .failOffsetX([-24, 24])
    .onUpdate((e) => {
      const y = Math.max(0, e.translationY);
      translateY.value = y;
      const h = Math.max(sheetHeightRef.current, 1);
      overlayOpacity.value = Math.max(0.2, 1 - y / h);
    })
    .onEnd((e) => {
      const shouldDismiss =
        e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY;
      if (shouldDismiss) {
        runOnJS(closeSheet)(true);
        return;
      }
      overlayOpacity.value = withTiming(1, { duration: 160 });
      translateY.value = withSpring(0, SHEET_SPRING);
    });

  const grabberNode = grabber ? (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={sheetStyles.grabberWrap}
        accessibilityRole="adjustable"
        accessibilityLabel="Drag to close"
      >
        <View style={sheetStyles.grabber} />
      </Animated.View>
    </GestureDetector>
  ) : null;

  if (!mounted) return null;

  const body = (
    <View
      style={[
        styles.root,
        presentation === "embedded" && styles.embeddedRoot,
      ]}
      pointerEvents="box-none"
    >
      <Animated.View style={[styles.overlayFill, overlayStyle]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleBackdrop}
          accessibilityLabel="Close"
        />
      </Animated.View>

      <Animated.View
        style={[styles.sheetWrap, contentStyle, sheetStyle]}
        onLayout={(e) => onSheetLayout(e.nativeEvent.layout.height)}
      >
        {header}
        {cardStyle ? (
          <View style={cardStyle}>
            {grabberNode}
            {children}
          </View>
        ) : (
          <>
            {grabberNode}
            {children}
          </>
        )}
        {footer}
      </Animated.View>
      {overlay}
    </View>
  );

  if (presentation === "embedded") {
    return body;
  }

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {body}
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  embeddedRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
  },
  overlayFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: SHEET_OVERLAY,
  },
  sheetWrap: {
    zIndex: 1,
  },
});
