import {
  ACCENT,
  BG,
  BORDER,
  BUTTON_RADIUS,
  MUTED3,
  ON_ACCENT_TEXT,
  TEXT,
  TYPE_SUBHEAD,
  fonts,
} from "@/constants/Variables";
import { cropProfilePhoto } from "@/src/lib/cropProfilePhoto";
import { SkeletonBlock } from "@/src/components/loading/BrandSkeletons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  Image,
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
  const [stageSize, setStageSize] = useState({
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  });
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

    // Average touches + single-pointer pan avoids trackedTouchCount clashes with pinch.
    const pan = Gesture.Pan()
      .averageTouches(true)
      .maxPointers(1)
      .minDistance(1)
      .onStart(() => {
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
      })
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

  // left/top/width/height match computeProfilePhotoCropRect (no scale matrix).
  const imageAnimatedStyle = useAnimatedStyle(() => {
    const width = imageWidth.value;
    const height = imageHeight.value;
    if (!width || !height) {
      return { opacity: 0 };
    }
    const baseScale = Math.max(
      PROFILE_PHOTO_CROP_SIZE / width,
      PROFILE_PHOTO_CROP_SIZE / height
    );
    const totalScale = baseScale * userScale.value;
    const scaledW = width * totalScale;
    const scaledH = height * totalScale;
    return {
      opacity: 1,
      width: scaledW,
      height: scaledH,
      left: (PROFILE_PHOTO_CROP_SIZE - scaledW) / 2 + translateX.value,
      top: (PROFILE_PHOTO_CROP_SIZE - scaledH) / 2 + translateY.value,
    };
  });

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

  const busy = processing || cropping;

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <View style={styles.container}>
        <GestureDetector gesture={composedGesture}>
          <Animated.View
            style={styles.cropStage}
            collapsable={false}
            onLayout={(event) => {
              const { width, height } = event.nativeEvent.layout;
              setStageSize({ width, height });
            }}
          >
            <View
              style={styles.cropTouchTarget}
              collapsable={false}
              onLayout={(event) => {
                const { x, y, width, height } = event.nativeEvent.layout;
                setCropCenter({ cx: x + width / 2, cy: y + height / 2 });
              }}
            >
              {imageSize ? (
                <Animated.View style={[styles.imageWrap, imageAnimatedStyle]}>
                  <Image
                    source={{ uri: imageUri }}
                    style={styles.image}
                    resizeMode="stretch"
                    pointerEvents="none"
                  />
                </Animated.View>
              ) : (
                <SkeletonBlock style={styles.imageSkeleton} />
              )}
            </View>

            {/* RN SVG often ignores pointerEvents on Svg itself — wrap it. */}
            <View style={styles.cropOverlay} pointerEvents="none">
              <Svg width={stageSize.width} height={stageSize.height}>
                <Defs>
                  <Mask id="profilePhotoCropMask">
                    <Rect
                      x={0}
                      y={0}
                      width={stageSize.width}
                      height={stageSize.height}
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
                  width={stageSize.width}
                  height={stageSize.height}
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
            </View>
          </Animated.View>
        </GestureDetector>

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
            <Text style={[styles.footerChoose, busy && { opacity: 0.5 }]}>Choose</Text>
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
  },
  cropTouchTarget: {
    width: PROFILE_PHOTO_CROP_SIZE,
    height: PROFILE_PHOTO_CROP_SIZE,
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  imageWrap: {
    position: "absolute",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imageSkeleton: {
    width: PROFILE_PHOTO_CROP_SIZE,
    height: PROFILE_PHOTO_CROP_SIZE,
    borderRadius: PROFILE_PHOTO_CROP_SIZE / 2,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  footerBtn: {
    flex: 1,
    minHeight: 52,
    borderRadius: BUTTON_RADIUS,
    alignItems: "center",
    justifyContent: "center",
  },
  footerBtnSecondary: {
    backgroundColor: BORDER,
    borderWidth: 1,
    borderColor: MUTED3,
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
