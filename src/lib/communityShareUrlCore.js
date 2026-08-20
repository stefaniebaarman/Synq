function normalizeShareCode(raw) {
  return String(raw || "")
    .trim()
    .toUpperCase();
}

function buildCommunityShareWebUrl(shareWebBase, shareCode) {
  const base = String(shareWebBase || "").replace(/\/$/, "");
  const code = normalizeShareCode(shareCode);
  if (!base || !code) return "";
  return `${base}/c/${encodeURIComponent(code)}`;
}

/**
 * Extract a community share code from a URL-like string.
 * Supports https://host/c/CODE and synq://c/CODE (hostname "c").
 */
function parseCommunityShareCodeFromUrl(url) {
  try {
    const raw = String(url || "").trim();
    if (!raw) return null;

    // synq://c/CODE or https://host/c/CODE
    const pathMatch = raw.match(/(?:^|[/:])c\/([^/?#]+)/i);
    if (pathMatch?.[1]) {
      const code = normalizeShareCode(decodeURIComponent(pathMatch[1]));
      return code || null;
    }

    const queryMatch = raw.match(/[?&]code=([^&#]+)/i);
    if (queryMatch?.[1]) {
      const code = normalizeShareCode(decodeURIComponent(queryMatch[1]));
      return code || null;
    }

    return null;
  } catch {
    return null;
  }
}

module.exports = {
  normalizeShareCode,
  buildCommunityShareWebUrl,
  parseCommunityShareCodeFromUrl,
};
