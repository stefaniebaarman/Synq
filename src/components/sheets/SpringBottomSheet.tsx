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
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
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
  /** Shared so pan worklets can read height without capturing a React ref. */
  const sheetHeightSV = useSharedValue(0);
  const closingRef = useRef(false);
  const wasMountedRef = useRef(visible);
  const onClosedRef = useRef(onClosed);
  const onCloseRef = useRef(onClose);
  const [mounted, setMounted] = useState(visible);
  const handleBackdrop = onBackdropPress ?? onClose;
  onClosedRef.current = onClosed;
  onCloseRef.current = onClose;

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

  /** If close animation is cancelled but parent still wants closed, unmount anyway. */
  const finishCloseIfStillClosing = useCallback(() => {
    if (!closingRef.current) return;
    finishClose();
  }, [finishClose]);

  const notifyParentClose = useCallback(() => {
    onCloseRef.current();
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
      const h = Math.max(sheetHeightSV.value, 1);
      cancelAnimation(translateY);
      cancelAnimation(overlayOpacity);
      if (reducedMotion) {
        translateY.value = h;
        overlayOpacity.value = 0;
        finishClose();
        if (notifyParent) notifyParentClose();
        return;
      }
      overlayOpacity.value = withTiming(0, { duration: SHEET_CLOSE_MS });
      translateY.value = withTiming(
        h,
        { duration: SHEET_CLOSE_MS, easing: Easing.inOut(Easing.cubic) },
        (finished) => {
          if (finished) {
            runOnJS(finishClose)();
            if (notifyParent) runOnJS(notifyParentClose)();
            return;
          }
          // Layout/keyboard can cancel the timing; don't leave a stuck Modal.
          runOnJS(finishCloseIfStillClosing)();
        }
      );
    },
    [
      finishClose,
      finishCloseIfStillClosing,
      notifyParentClose,
      overlayOpacity,
      reducedMotion,
      sheetHeightSV,
      translateY,
    ]
  );

  const onSheetLayout = useCallback(
    (height: number) => {
      if (height <= 0) return;
      const prev = sheetHeightSV.value;
      sheetHeightSV.value = height;
      // Never write translateY while closing — that cancels withTiming and
      // leaves the Modal mounted (frozen dim). Keyboard dismiss often relayouts.
      if (closingRef.current) return;
      if (!visible) {
        translateY.value = height;
        return;
      }
      if (prev <= 0) {
        translateY.value = height;
        openSheet();
      }
    },
    [openSheet, sheetHeightSV, translateY, visible]
  );

  useEffect(() => {
    if (visible) {
      setMounted(true);
      if (sheetHeightSV.value > 0) openSheet();
      return;
    }
    if (!mounted) return;
    closeSheet(false);
  }, [visible, mounted, openSheet, closeSheet, sheetHeightSV]);

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
      "worklet";
      const y = Math.max(0, e.translationY);
      translateY.value = y;
      const h = Math.max(sheetHeightSV.value, 1);
      overlayOpacity.value = Math.max(0.2, 1 - y / h);
    })
    .onEnd((e) => {
      "worklet";
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
      onRequestClose={notifyParentClose}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={styles.gestureRoot}>{body}</GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
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
