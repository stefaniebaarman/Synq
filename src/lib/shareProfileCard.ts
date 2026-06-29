import type { RefObject } from "react";
import { Platform, Share } from "react-native";
import { captureRef } from "react-native-view-shot";
import type ViewShot from "react-native-view-shot";

import { uploadProfileShareCard } from "./uploadProfileShareCard";

function isShareDismissed(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return /cancel|dismiss/i.test(message);
}

function waitForNextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

let cachedCardKey = "";
let cachedCardUri: string | null = null;
let captureInFlight: Promise<string | null> | null = null;
let captureInFlightKey = "";

let expectedAvatarUri = "";
let avatarPainted = false;
const avatarPaintWaiters = new Set<() => void>();
const AVATAR_PAINT_TIMEOUT_MS = 8000;

/** Reset avatar readiness when the share card's avatar URL changes. */
export function syncShareCardAvatarUri(uri: string): void {
  const next = uri.trim();
  if (next === expectedAvatarUri) return;
  expectedAvatarUri = next;
  avatarPainted = false;
}

/** Call when the share card avatar image has loaded (or failed). */
export function markShareCardAvatarPainted(uri: string): void {
  if (uri.trim() !== expectedAvatarUri) return;
  avatarPainted = true;
  avatarPaintWaiters.forEach((resolve) => resolve());
  avatarPaintWaiters.clear();
}

function waitForShareCardAvatarPainted(): Promise<void> {
  if (avatarPainted || !expectedAvatarUri) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => {
      avatarPaintWaiters.delete(finish);
      resolve();
    };
    avatarPaintWaiters.add(finish);
    setTimeout(finish, AVATAR_PAINT_TIMEOUT_MS);
  });
}

async function captureProfileShareCard(
  cardRef: RefObject<ViewShot | null>
): Promise<string | null> {
  if (!cardRef.current) return null;
  await waitForShareCardAvatarPainted();
  await waitForNextFrame();
  await waitForNextFrame();
  return captureRef(cardRef, {
    format: "png",
    quality: 0.92,
    result: "tmpfile",
    ...(Platform.OS === "ios" ? { useRenderInContext: true } : {}),
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

/** Pre-capture the card and upload for link unfurl previews (iMessage, etc.). */
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
