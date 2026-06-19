/** Copy pattern for contentFilter.ts — terms live in contentFilterTerms.ts. */
import { BLOCKED_TERMS as BLOCKED_TERMS_LIST } from "./contentFilterTerms";

const BLOCKED_TERMS: string[] = [...BLOCKED_TERMS_LIST];

const LEET_MAP: Record<string, string> = {
  "@": "a",
  "4": "a",
  "3": "e",
  "1": "i",
  "!": "i",
  "0": "o",
  "$": "s",
  "5": "s",
  "7": "t",
};

export function normalizeForFilter(input: string): string {
  let s = String(input || "").toLowerCase();
  s = s.replace(/[\s_\-.*]+/g, "");
  s = s
    .split("")
    .map((ch) => LEET_MAP[ch] ?? ch)
    .join("");
  s = s.replace(/[^a-z0-9]/g, "");
  return s.replace(/(.)\1{2,}/g, "$1$1");
}

export function containsObjectionableContent(text: string): boolean {
  const normalized = normalizeForFilter(text);
  if (!normalized) return false;
  return BLOCKED_TERMS.some((term) => normalized.includes(term));
}

export function filterOrReject(text: string): { ok: true } | { ok: false; reason: string } {
  if (containsObjectionableContent(text)) {
    return {
      ok: false,
      reason: "This content isn't allowed on Synq. Please remove offensive language.",
    };
  }
  return { ok: true };
}
