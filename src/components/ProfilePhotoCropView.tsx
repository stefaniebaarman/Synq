import {
  ACCENT,
  BG,
  BUTTON_RADIUS,
  ON_ACCENT_TEXT,
  TEXT,
  TYPE_SUBHEAD,
  fonts,
} from "@/constants/Variables";
import { cropProfilePhoto } from "@/src/lib/cropProfilePhoto";
import { Image as ExpoImage } from "expo-image";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, Mask, Rect } from "react-native-svg";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
export const PROFILE_PHOTO_CROP_SIZE = Math.min(SCREEN_WIDTH - 48, 320);
const MIN_USER_SCALE = 1;
const MAX_USER_SCALE = 4;

type Props = {
  imageUri: string;
  imageWidth?: number;
  imageHeight?: number;
  processing?: boolean;
  onCancel: () => void;
  onChoose: (croppedUri: string) => void;
};

function clampTranslation(
  tx: number,
  ty: number,
  scale: number,
  width: number,
  height: number
) {
  "worklet";
  const baseScale = Math.max(
    PROFILE_PHOTO_CROP_SIZE / width,
    PROFILE_PHOTO_CROP_SIZE / height
  );
  const totalScale = baseScale * scale;
  const scaledW = width * totalScale;
  const scaledH = height * totalScale;
  const maxX = Math.max(0, (scaledW - PROFILE_PHOTO_CROP_SIZE) / 2);
  const maxY = Math.max(0, (scaledH - PROFILE_PHOTO_CROP_SIZE) / 2);
  return {
    x: Math.min(maxX, Math.max(-maxX, tx)),
    y: Math.min(maxY, Math.max(-maxY, ty)),
  };
}

export default function ProfilePhotoCropView({
  imageUri,
  imageWidth: initialImageWidth,
  imageHeight: initialImageHeight,
  processing = false,
  onCancel,
  onChoose,
}: Props) {
  const insets = useSafeAreaInsets();
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(
    null
  );
  const [cropping, setCropping] = useState(false);
  const [cropCenter, setCropCenter] = useState({
    cx: SCREEN_WIDTH / 2,
    cy: SCREEN_HEIGHT / 2,
  });

  const userScale = useSharedValue(1);
  const savedUserScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const imageWidth = useSharedValue(0);
  const imageHeight = useSharedValue(0);

  const resetTransforms = useCallback(() => {
    userScale.value = 1;
    savedUserScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  }, [
    savedTranslateX,
    savedTranslateY,
    savedUserScale,
    translateX,
    translateY,
    userScale,
  ]);

  useEffect(() => {
    resetTransforms();

    if (initialImageWidth && initialImageHeight) {
      setImageSize({ width: initialImageWidth, height: initialImageHeight });
      imageWidth.value = initialImageWidth;
      imageHeight.value = initialImageHeight;
      return;
    }

    setImageSize(null);
    imageWidth.value = 0;
    imageHeight.value = 0;
  }, [
    imageUri,
    imageHeight,
    imageWidth,
    initialImageHeight,
    initialImageWidth,
    resetTransforms,
  ]);

  const composedGesture = useMemo(() => {
    const pinch = Gesture.Pinch()
      .onStart(() => {
        savedUserScale.value = userScale.value;
      })
      .onUpdate((event) => {
        const width = imageWidth.value;
        const height = imageHeight.value;
        if (!width || !height) return;

        const nextScale = Math.min(
          MAX_USER_SCALE,
          Math.max(MIN_USER_SCALE, savedUserScale.value * event.scale)
        );
        userScale.value = nextScale;

        const clamped = clampTranslation(
          translateX.value,
          translateY.value,
          nextScale,
          width,
          height
        );
        translateX.value = clamped.x;
        translateY.value = clamped.y;
      })
      .onEnd(() => {
        savedUserScale.value = userScale.value;
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
      });

    const pan = Gesture.Pan()
      .minDistance(0)
      .maxPointers(1)
      .onUpdate((event) => {
        const width = imageWidth.value;
        const height = imageHeight.value;
        if (!width || !height) return;

        const clamped = clampTranslation(
          savedTranslateX.value + event.translationX,
          savedTranslateY.value + event.translationY,
          userScale.value,
          width,
          height
        );
        translateX.value = clamped.x;
        translateY.value = clamped.y;
      })
      .onEnd(() => {
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
      });

    return Gesture.Simultaneous(pinch, pan);
  }, [
    imageHeight,
    imageWidth,
    savedTranslateX,
    savedTranslateY,
    savedUserScale,
    translateX,
    translateY,
    userScale,
  ]);

  const imageAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: userScale.value },
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  const handleChoose = async () => {
    if (!imageSize || processing || cropping) return;

    setCropping(true);
    try {
      const croppedUri = await cropProfilePhoto(imageUri, {
        imageWidth: imageSize.width,
        imageHeight: imageSize.height,
        cropSize: PROFILE_PHOTO_CROP_SIZE,
        userScale: userScale.value,
        translateX: translateX.value,
        translateY: translateY.value,
      });
      onChoose(croppedUri);
    } finally {
      setCropping(false);
    }
  };

  const baseDisplay = imageSize
    ? (() => {
        const baseScale = Math.max(
          PROFILE_PHOTO_CROP_SIZE / imageSize.width,
          PROFILE_PHOTO_CROP_SIZE / imageSize.height
        );
        return {
          width: imageSize.width * baseScale,
          height: imageSize.height * baseScale,
        };
      })()
    : null;

  const busy = processing || cropping;

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <View style={styles.container}>
        <View style={styles.cropStage}>
          <Svg
            width={SCREEN_WIDTH}
            height={SCREEN_HEIGHT}
            style={styles.cropOverlay}
            pointerEvents="none"
          >
            <Defs>
              <Mask id="profilePhotoCropMask">
                <Rect
                  x={0}
                  y={0}
                  width={SCREEN_WIDTH}
                  height={SCREEN_HEIGHT}
                  fill="white"
                />
                <Circle
                  cx={cropCenter.cx}
                  cy={cropCenter.cy}
                  r={PROFILE_PHOTO_CROP_SIZE / 2}
                  fill="black"
                />
              </Mask>
            </Defs>
            <Rect
              x={0}
              y={0}
              width={SCREEN_WIDTH}
              height={SCREEN_HEIGHT}
              fill={BG}
              mask="url(#profilePhotoCropMask)"
            />
            <Circle
              cx={cropCenter.cx}
              cy={cropCenter.cy}
              r={PROFILE_PHOTO_CROP_SIZE / 2}
              fill="none"
              stroke={ACCENT}
              strokeWidth={2}
            />
          </Svg>

          <GestureDetector gesture={composedGesture}>
            <View
              style={styles.cropTouchTarget}
              collapsable={false}
              onLayout={(event) => {
                const { x, y, width, height } = event.nativeEvent.layout;
                setCropCenter({ cx: x + width / 2, cy: y + height / 2 });
              }}
            >
              {baseDisplay ? (
                <Animated.View
                  style={[
                    styles.imageWrap,
                    {
                      width: baseDisplay.width,
                      height: baseDisplay.height,
                      left: (PROFILE_PHOTO_CROP_SIZE - baseDisplay.width) / 2,
                      top: (PROFILE_PHOTO_CROP_SIZE - baseDisplay.height) / 2,
                    },
                    imageAnimatedStyle,
                  ]}
                >
                  <ExpoImage
                    source={{ uri: imageUri }}
                    style={styles.image}
                    contentFit="cover"
                    onLoad={(event) => {
                      const { width, height } = event.source;
                      if (!width || !height || imageSize) return;
                      setImageSize({ width, height });
                      imageWidth.value = width;
                      imageHeight.value = height;
                    }}
                  />
                </Animated.View>
              ) : (
                <ActivityIndicator color={ACCENT} style={styles.loader} />
              )}
            </View>
          </GestureDetector>
        </View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
          <Pressable
            onPress={onCancel}
            disabled={busy}
            style={({ pressed }) => [
              styles.footerBtn,
              styles.footerBtnSecondary,
              pressed && styles.footerPressed,
              busy && styles.footerDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={styles.footerCancel}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleChoose}
            disabled={!imageSize || busy}
            style={({ pressed }) => [
              styles.footerBtn,
              styles.footerBtnPrimary,
              pressed && imageSize && !busy && styles.footerPressed,
              (!imageSize || busy) && styles.footerDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Choose"
          >
            {busy ? (
              <ActivityIndicator color={ON_ACCENT_TEXT} />
            ) : (
              <Text style={styles.footerChoose}>Choose</Text>
            )}
          </Pressable>
        </View>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  cropStage: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  cropOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  cropTouchTarget: {
    width: PROFILE_PHOTO_CROP_SIZE,
    height: PROFILE_PHOTO_CROP_SIZE,
    borderRadius: PROFILE_PHOTO_CROP_SIZE / 2,
    overflow: "hidden",
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: ACCENT,
    zIndex: 1,
  },
  imageWrap: {
    position: "absolute",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  loader: {
    flex: 1,
    alignSelf: "center",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    zIndex: 2,
  },
  footerBtn: {
    flex: 1,
    minHeight: 52,
    borderRadius: BUTTON_RADIUS,
    alignItems: "center",
    justifyContent: "center",
  },
  footerBtnSecondary: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  footerBtnPrimary: {
    backgroundColor: ACCENT,
  },
  footerCancel: {
    color: TEXT,
    fontSize: TYPE_SUBHEAD,
    fontFamily: fonts.medium,
  },
  footerChoose: {
    color: ON_ACCENT_TEXT,
    fontSize: TYPE_SUBHEAD,
    fontFamily: fonts.heavy,
  },
  footerPressed: {
    opacity: 0.55,
  },
  footerDisabled: {
    opacity: 0.4,
  },
});
