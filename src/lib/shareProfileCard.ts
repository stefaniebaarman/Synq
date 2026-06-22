import type { RefObject } from "react";
import { Share } from "react-native";
import { captureRef } from "react-native-view-shot";
import type ViewShot from "react-native-view-shot";

import { uploadProfileShareCard } from "./uploadProfileShareCard";

function waitForNextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

function isShareDismissed(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return /cancel|dismiss/i.test(message);
}

/** Opens the native share sheet with the profile link. */
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

/** Captures and uploads the OG preview card without blocking the share sheet. */
export function warmProfileShareOgPreview(
  cardRef: RefObject<ViewShot | null>
): void {
  void (async () => {
    if (!cardRef.current) return;
    try {
      await waitForNextFrame();
      const imageUri = await captureRef(cardRef, {
        format: "png",
        quality: 0.92,
        result: "tmpfile",
      });
      await uploadProfileShareCard(imageUri);
    } catch {
      // OG preview is optional.
    }
  })();
}
