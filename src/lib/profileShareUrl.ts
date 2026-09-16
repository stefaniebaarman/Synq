import { SYNQ_SHARE_WEB_BASE } from "@/constants/Variables";
import { getFunctions, httpsCallable } from "firebase/functions";
import * as Linking from "expo-linking";

function normalizeInviteCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function buildProfileShareWebUrl(inviteCode: string): string {
  const code = normalizeInviteCode(inviteCode);
  if (!code) return "";
  return `${SYNQ_SHARE_WEB_BASE}/u/${encodeURIComponent(code)}`;
}

export function parseProfileShareCodeFromUrl(url: string): string | null {
  try {
    const parsed = Linking.parse(url);
    const path = String(parsed.path || "")
      .trim()
      .replace(/^\//, "");
    const pathMatch = path.match(/^u\/([^/?#]+)/i);
    if (pathMatch?.[1]) {
      const code = normalizeInviteCode(decodeURIComponent(pathMatch[1]));
      return code || null;
    }
    const hostname = String(parsed.hostname || "")
      .trim()
      .toLowerCase();
    if (hostname === "u") {
      const fromHostPath = String(parsed.path || "")
        .replace(/^\//, "")
        .trim();
      if (fromHostPath) {
        const code = normalizeInviteCode(decodeURIComponent(fromHostPath));
        return code || null;
      }
    }
    const codeRaw = parsed.queryParams?.code;
    const fromQuery = Array.isArray(codeRaw) ? codeRaw[0] : codeRaw;
    if (typeof fromQuery === "string" && fromQuery.trim()) {
      const code = normalizeInviteCode(fromQuery);
      return code || null;
    }
    return null;
  } catch {
    return null;
  }
}

async function acceptInviteFromLinkCall(payload: {
  inviteCode?: string;
  fromUid?: string;
}): Promise<string | null> {
  const functions = getFunctions(undefined, "us-central1");
  const acceptInviteFromLink = httpsCallable(functions, "acceptInviteFromLink");
  const result = await acceptInviteFromLink(payload);
  const fromUid = String(
    (result.data as { fromUid?: unknown } | undefined)?.fromUid || ""
  ).trim();
  return fromUid || payload.fromUid?.trim() || null;
}

/**
 * Profile share / QR codes should create a pending friend request so the
 * profile is readable under Firestore rules (same as invite links).
 * Does not open a profile id without a successful connect.
 */
export async function connectViaProfileShareCode(
  inviteCode: string
): Promise<string | null> {
  const code = normalizeInviteCode(inviteCode);
  if (!code) return null;
  return acceptInviteFromLinkCall({ inviteCode: code });
}

/** Connect via raw user id (legacy deep links / QR payloads). */
export async function connectViaProfileUserId(
  fromUid: string
): Promise<string | null> {
  const uid = String(fromUid || "").trim();
  if (!uid) return null;
  return acceptInviteFromLinkCall({ fromUid: uid });
}

function parseFriendProfileIdFromUrl(url: string): string | null {
  try {
    const parsed = Linking.parse(url);
    const path = String(parsed.path || "")
      .trim()
      .replace(/^\//, "");
    const hostname = String(parsed.hostname || "").trim();
    const isFriendProfile =
      hostname === "friend-profile" || path === "friend-profile";
    if (!isFriendProfile) return null;
    const friendIdRaw = parsed.queryParams?.friendId;
    const friendId = Array.isArray(friendIdRaw) ? friendIdRaw[0] : friendIdRaw;
    const trimmed = typeof friendId === "string" ? friendId.trim() : "";
    return trimmed || null;
  } catch {
    return null;
  }
}

/** Resolve a scanned profile QR payload to a Firebase user id. */
export async function resolveFriendIdFromScannedProfileQr(
  rawData: string
): Promise<string | null> {
  const data = rawData.trim();
  if (!data) return null;

  const shareCode = parseProfileShareCodeFromUrl(data);
  if (shareCode) {
    return connectViaProfileShareCode(shareCode);
  }

  const fromProfileLink = parseFriendProfileIdFromUrl(data);
  if (fromProfileLink) {
    return connectViaProfileUserId(fromProfileLink);
  }

  return null;
}
