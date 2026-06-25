import type { RefObject } from "react";
import { Platform, Share } from "react-native";
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

function toShareableFileUri(uri: string): string {
  if (uri.startsWith("file://")) return uri;
  return `file://${uri}`;
}

function isShareDismissed(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return /cancel|dismiss/i.test(message);
}

let cachedCardKey = "";
let cachedCardUri: string | null = null;
let captureInFlight: Promise<string | null> | null = null;
let captureInFlightKey = "";

async function captureProfileShareCard(
  cardRef: RefObject<ViewShot | null>
): Promise<string | null> {
  if (!cardRef.current) return null;
  await waitForNextFrame();
  return captureRef(cardRef, {
    format: "png",
    quality: 0.92,
    result: "tmpfile",
  });
}

function startCardCapture(
  cardRef: RefObject<ViewShot | null>,
  cacheKey: string
): Promise<string | null> {
  if (captureInFlight && captureInFlightKey === cacheKey) {
    return captureInFlight;
  }

  captureInFlightKey = cacheKey;
  captureInFlight = captureProfileShareCard(cardRef)
    .then((uri) => {
      if (uri && captureInFlightKey === cacheKey) {
        cachedCardKey = cacheKey;
        cachedCardUri = uri;
        void uploadProfileShareCard(uri).catch(() => {});
      }
      return uri;
    })
    .catch(() => null)
    .finally(() => {
      captureInFlight = null;
      captureInFlightKey = "";
    });

  return captureInFlight;
}

export function isProfileShareCardCached(cacheKey: string): boolean {
  return Boolean(cacheKey && cacheKey === cachedCardKey && cachedCardUri);
}

export function invalidateProfileShareCardCache(): void {
  cachedCardKey = "";
  cachedCardUri = null;
}

/** Pre-capture the card so share opens instantly with the image attached. */
export function warmProfileShareCardCapture(
  cardRef: RefObject<ViewShot | null>,
  cacheKey: string
): void {
  if (!cacheKey || !cardRef.current) return;
  if (isProfileShareCardCached(cacheKey)) return;
  void startCardCapture(cardRef, cacheKey);
}

/** Opens the native share sheet with the profile link only. */
export async function shareProfileLink(shareWebUrl: string): Promise<void> {
  const url = shareWebUrl.trim();
  if (!url) {
    throw new Error("Profile share link is not ready.");
  }

  try {
    await Share.share({ message: url });
  } catch (error) {
    if (isShareDismissed(error)) return;
    throw error;
  }
}

/** Shares the profile card image and link; uses a pre-warmed capture when available. */
export async function shareProfileWithCard(
  cardRef: RefObject<ViewShot | null>,
  shareWebUrl: string,
  cacheKey: string
): Promise<void> {
  const link = shareWebUrl.trim();
  if (!link) {
    throw new Error("Profile share link is not ready.");
  }

  let imageUri =
    cacheKey && cacheKey === cachedCardKey ? cachedCardUri : null;
  if (!imageUri) {
    imageUri = await startCardCapture(cardRef, cacheKey);
  }

  if (!imageUri) {
    await shareProfileLink(link);
    return;
  }

  void uploadProfileShareCard(imageUri).catch(() => {});

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
