import type { RefObject } from "react";
import { Platform, Share } from "react-native";
import { captureRef } from "react-native-view-shot";
import type ViewShot from "react-native-view-shot";

function waitForNextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

function toShareableFileUri(uri: string): string {
  if (uri.startsWith("file://")) return uri;
  return `file://${uri}`;
}

function isShareDismissed(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return /cancel|dismiss/i.test(message);
}

/** Text-only fallback when the card image cannot be captured. */
export async function shareProfileLink(shareWebUrl: string): Promise<void> {
  const url = shareWebUrl.trim();
  if (!url) {
    throw new Error("Profile share link is not ready.");
  }

  try {
    await Share.share({
      message: url,
    });
  } catch (error) {
    if (isShareDismissed(error)) return;
    throw error;
  }
}

/** Shares the profile card image and the profile link as separate items. */
export async function captureAndShareProfileCard(
  cardRef: RefObject<ViewShot | null>,
  shareWebUrl: string
): Promise<void> {
  if (!cardRef.current) {
    throw new Error("Profile share card is not ready.");
  }
  if (!shareWebUrl.trim()) {
    throw new Error("Profile share link is not ready.");
  }

  await waitForNextFrame();
  await new Promise((resolve) => setTimeout(resolve, 150));

  const imageUri = await captureRef(cardRef, {
    format: "png",
    quality: 0.92,
    result: "tmpfile",
  });

  const link = shareWebUrl.trim();
  const shareImageUri = toShareableFileUri(imageUri);

  try {
    if (Platform.OS === "ios") {
      await Share.share({ message: link, url: shareImageUri });
      return;
    }

    await Share.share({
      message: link,
      url: shareImageUri,
    });
  } catch (error) {
    if (isShareDismissed(error)) return;
    throw error;
  }
}
