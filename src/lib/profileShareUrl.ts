import { SYNQ_SHARE_WEB_BASE } from "@/constants/Variables";
import * as Linking from "expo-linking";

function normalizeInviteCode(raw: string): string {
  return raw.trim().toUpperCase();
}

/** Branded share link — `/u/{inviteCode}` instead of exposing a Firebase user id. */
export function buildProfileShareWebUrl(inviteCode: string): string {
  const code = normalizeInviteCode(inviteCode);
  if (!code) return "";
  return `${SYNQ_SHARE_WEB_BASE}/u/${encodeURIComponent(code)}`;
}

/** Short in-message link (no Firebase hostname) — opens Synq when installed. */
export function buildProfileShareAppUrl(inviteCode: string): string {
  const code = normalizeInviteCode(inviteCode);
  if (!code) return "";
  return Linking.createURL(`u/${encodeURIComponent(code)}`);
}

/** Custom-scheme deep link for in-app use (e.g. QR scanned from within Synq). */
export function buildProfileDeepLinkUrl(friendId: string): string {
  const id = friendId.trim();
  if (!id) return "";
  return Linking.createURL("/friend-profile", {
    queryParams: { friendId: id },
  });
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

export async function resolveProfileShareCodeToFriendId(
  inviteCode: string
): Promise<string | null> {
  const code = normalizeInviteCode(inviteCode);
  if (!code) return null;
  try {
    const res = await fetch(
      `${SYNQ_SHARE_WEB_BASE}/api/resolve-profile-share?code=${encodeURIComponent(code)}`
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { friendId?: unknown };
    const friendId = typeof data.friendId === "string" ? data.friendId.trim() : "";
    return friendId || null;
  } catch {
    return null;
  }
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

  const fromProfileLink = parseFriendProfileIdFromUrl(data);
  if (fromProfileLink) return fromProfileLink;

  const shareCode = parseProfileShareCodeFromUrl(data);
  if (shareCode) {
    return resolveProfileShareCodeToFriendId(shareCode);
  }

  return null;
}
