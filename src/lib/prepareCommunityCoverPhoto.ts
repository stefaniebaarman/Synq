import * as ImageManipulator from "expo-image-manipulator";
import { Image } from "react-native";

/** Longest edge for hero display (~430pt @3x); keeps uploads small without visible quality loss. */
export const COMMUNITY_COVER_UPLOAD_MAX_DIMENSION = 1280;

export const COMMUNITY_COVER_UPLOAD_QUALITY = 0.82;

/** Square list avatar — 48pt @3x. */
export const COMMUNITY_COVER_THUMB_SIZE = 144;

export const COMMUNITY_COVER_THUMB_QUALITY = 0.8;

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

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}

/** Normalize orientation, downscale, and compress before uploading to Storage. */
export async function prepareCommunityCoverPhoto(uri: string): Promise<string> {
  const normalized = await ImageManipulator.manipulateAsync(uri, [], {
    compress: 0.92,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  const { width, height } = await getImageSize(normalized.uri);
  const resize = resizeToMaxDimension(
    width,
    height,
    COMMUNITY_COVER_UPLOAD_MAX_DIMENSION
  );

  if (!resize) {
    const compressed = await ImageManipulator.manipulateAsync(normalized.uri, [], {
      compress: COMMUNITY_COVER_UPLOAD_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    return compressed.uri;
  }

  const result = await ImageManipulator.manipulateAsync(
    normalized.uri,
    [{ resize }],
    {
      compress: COMMUNITY_COVER_UPLOAD_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
    }
  );
  return result.uri;
}

/** Center-crop square thumb from an already-prepared cover JPEG. */
export async function prepareCommunityCoverThumb(preparedCoverUri: string): Promise<string> {
  const { width, height } = await getImageSize(preparedCoverUri);
  const size = Math.min(width, height);
  const originX = Math.round((width - size) / 2);
  const originY = Math.round((height - size) / 2);

  const result = await ImageManipulator.manipulateAsync(
    preparedCoverUri,
    [
      { crop: { originX, originY, width: size, height: size } },
      {
        resize: {
          width: COMMUNITY_COVER_THUMB_SIZE,
          height: COMMUNITY_COVER_THUMB_SIZE,
        },
      },
    ],
    {
      compress: COMMUNITY_COVER_THUMB_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
    }
  );
  return result.uri;
}
