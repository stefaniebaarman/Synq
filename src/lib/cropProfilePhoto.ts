import * as ImageManipulator from "expo-image-manipulator";

/** Max edge length while cropping; keeps preview math fast on camera originals. */
export const PROFILE_PHOTO_CROP_PREP_MAX_DIMENSION = 2048;

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
  // Same screen-space placement as ProfilePhotoCropView's animated left/top.
  const offsetX = (cropSize - scaledW) / 2 + translateX;
  const offsetY = (cropSize - scaledH) / 2 + translateY;

  const originX = Math.max(0, Math.round(-offsetX / totalScale));
  const originY = Math.max(0, Math.round(-offsetY / totalScale));
  const cropEdge = Math.max(1, Math.round(cropSize / totalScale));
  const width = Math.min(imageWidth - originX, cropEdge);
  const height = Math.min(imageHeight - originY, cropEdge);
  const size = Math.max(1, Math.min(width, height));

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

  const resize = resizeToMaxDimension(
    normalized.width,
    normalized.height,
    PROFILE_PHOTO_CROP_PREP_MAX_DIMENSION
  );
  if (!resize) {
    return {
      uri: normalized.uri,
      width: normalized.width,
      height: normalized.height,
    };
  }

  const downscaled = await ImageManipulator.manipulateAsync(
    normalized.uri,
    [{ resize }],
    { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG }
  );

  return {
    uri: downscaled.uri,
    width: downscaled.width,
    height: downscaled.height,
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
