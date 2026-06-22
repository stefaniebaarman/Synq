import * as ImageManipulator from "expo-image-manipulator";
import { Image } from "react-native";

/** Max edge length while cropping; keeps preview math fast on camera originals. */
export const PROFILE_PHOTO_CROP_PREP_MAX_DIMENSION = 2048;

/** Uploaded avatar size — sharp through 64pt @3x list cells; keeps Storage egress low. */
export const PROFILE_PHOTO_UPLOAD_SIZE = 384;

export const PROFILE_PHOTO_UPLOAD_QUALITY = 0.85;

export type ProfilePhotoCropParams = {
  imageWidth: number;
  imageHeight: number;
  cropSize: number;
  userScale: number;
  translateX: number;
  translateY: number;
};

export function computeProfilePhotoCropRect({
  imageWidth,
  imageHeight,
  cropSize,
  userScale,
  translateX,
  translateY,
}: ProfilePhotoCropParams) {
  const baseScale = Math.max(cropSize / imageWidth, cropSize / imageHeight);
  const totalScale = baseScale * userScale;
  const scaledW = imageWidth * totalScale;
  const scaledH = imageHeight * totalScale;
  const offsetX = (cropSize - scaledW) / 2 + translateX;
  const offsetY = (cropSize - scaledH) / 2 + translateY;

  const originX = Math.max(0, Math.round(-offsetX / totalScale));
  const originY = Math.max(0, Math.round(-offsetY / totalScale));
  const width = Math.min(imageWidth - originX, Math.round(cropSize / totalScale));
  const height = Math.min(imageHeight - originY, Math.round(cropSize / totalScale));
  const size = Math.min(width, height);

  return { originX, originY, width: size, height: size };
}

function resizeToMaxDimension(
  width: number,
  height: number,
  maxDimension: number
): { width: number; height: number } | null {
  const longest = Math.max(width, height);
  if (longest <= maxDimension) return null;

  const scale = maxDimension / longest;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

/** Bake EXIF orientation into pixels so preview and crop math use the same dimensions. */
export async function prepareProfilePhotoForCrop(
  uri: string
): Promise<{ uri: string; width: number; height: number }> {
  const normalized = await ImageManipulator.manipulateAsync(uri, [], {
    compress: 0.92,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  const { width, height } = await new Promise<{ width: number; height: number }>(
    (resolve, reject) => {
      Image.getSize(
        normalized.uri,
        (w, h) => resolve({ width: w, height: h }),
        reject
      );
    }
  );

  const resize = resizeToMaxDimension(
    width,
    height,
    PROFILE_PHOTO_CROP_PREP_MAX_DIMENSION
  );
  if (!resize) {
    return { uri: normalized.uri, width, height };
  }

  const downscaled = await ImageManipulator.manipulateAsync(
    normalized.uri,
    [{ resize }],
    { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG }
  );

  return {
    uri: downscaled.uri,
    width: resize.width,
    height: resize.height,
  };
}

export async function cropProfilePhoto(
  uri: string,
  params: ProfilePhotoCropParams,
  quality = PROFILE_PHOTO_UPLOAD_QUALITY
): Promise<string> {
  const rect = computeProfilePhotoCropRect(params);
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [
      { crop: rect },
      {
        resize: {
          width: PROFILE_PHOTO_UPLOAD_SIZE,
          height: PROFILE_PHOTO_UPLOAD_SIZE,
        },
      },
    ],
    { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}
