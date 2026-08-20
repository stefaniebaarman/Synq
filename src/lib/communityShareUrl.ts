import { SYNQ_SHARE_WEB_BASE } from "@/constants/Variables";
import * as Linking from "expo-linking";
import {
  buildCommunityShareWebUrl as buildWebUrlCore,
  normalizeShareCode,
  parseCommunityShareCodeFromUrl as parseCodeCore,
} from "./communityShareUrlCore.js";

export const PENDING_COMMUNITY_SHARE_CODE_KEY = "synq:pendingCommunityShareCode";

export function buildCommunityShareWebUrl(shareCode: string): string {
  return buildWebUrlCore(SYNQ_SHARE_WEB_BASE, shareCode);
}

/** Short in-message link (no Firebase hostname) — opens Synq when installed. */
export function buildCommunityShareAppUrl(shareCode: string): string {
  const code = normalizeShareCode(shareCode);
  if (!code) return "";
  return Linking.createURL(`c/${encodeURIComponent(code)}`);
}

export function parseCommunityShareCodeFromUrl(url: string): string | null {
  return parseCodeCore(url);
}

export async function resolveCommunityShareCodeToGroupId(
  shareCode: string
): Promise<string | null> {
  const code = normalizeShareCode(shareCode);
  if (!code) return null;
  try {
    const res = await fetch(
      `${SYNQ_SHARE_WEB_BASE}/api/resolve-community-share?code=${encodeURIComponent(code)}`
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { groupId?: unknown };
    const groupId = typeof data.groupId === "string" ? data.groupId.trim() : "";
    return groupId || null;
  } catch {
    return null;
  }
}
