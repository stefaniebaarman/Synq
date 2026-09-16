const CLIPBOARD_PREFIX = "SYNQ-A:";

function normalizeAmbassadorCode(raw) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "");
}

function isValidAmbassadorCodeShape(code) {
  return /^[A-Z0-9][A-Z0-9-]{1,31}$/.test(code);
}

function buildAmbassadorShareWebUrl(shareWebBase, code) {
  const base = String(shareWebBase || "").replace(/\/$/, "");
  const normalized = normalizeAmbassadorCode(code);
  if (!base || !isValidAmbassadorCodeShape(normalized)) return "";
  return `${base}/a/${encodeURIComponent(normalized)}`;
}

function parseAmbassadorCodeFromClipboard(raw) {
  const text = String(raw || "").trim();
  if (!text.toUpperCase().startsWith(CLIPBOARD_PREFIX)) return null;
  const code = normalizeAmbassadorCode(text.slice(CLIPBOARD_PREFIX.length));
  return isValidAmbassadorCodeShape(code) ? code : null;
}

function parseAmbassadorCodeFromReferrer(referrer) {
  const raw = String(referrer || "").trim();
  if (!raw) return null;
  try {
    const params = new URLSearchParams(raw);
    const fromAmbassador = normalizeAmbassadorCode(
      params.get("ambassador") || ""
    );
    if (isValidAmbassadorCodeShape(fromAmbassador)) return fromAmbassador;
    const fromContent = normalizeAmbassadorCode(params.get("utm_content") || "");
    if (isValidAmbassadorCodeShape(fromContent)) return fromContent;
  } catch {
    // fall through
  }
  const ambassadorMatch = raw.match(/(?:^|&)ambassador=([^&]+)/i);
  if (ambassadorMatch?.[1]) {
    const code = normalizeAmbassadorCode(decodeURIComponent(ambassadorMatch[1]));
    if (isValidAmbassadorCodeShape(code)) return code;
  }
  const contentMatch = raw.match(/(?:^|&)utm_content=([^&]+)/i);
  if (contentMatch?.[1]) {
    const code = normalizeAmbassadorCode(decodeURIComponent(contentMatch[1]));
    if (isValidAmbassadorCodeShape(code)) return code;
  }
  return null;
}

/**
 * Extract an ambassador code from a URL-like string.
 * Supports https://host/a/CODE and synq://a/CODE.
 */
function parseAmbassadorCodeFromUrl(url) {
  try {
    const raw = String(url || "").trim();
    if (!raw) return null;

    const pathMatch = raw.match(/(?:^|[/:])a\/([^/?#]+)/i);
    if (pathMatch?.[1]) {
      const code = normalizeAmbassadorCode(decodeURIComponent(pathMatch[1]));
      return isValidAmbassadorCodeShape(code) ? code : null;
    }

    const queryMatch = raw.match(/[?&](?:code|ambassador)=([^&#]+)/i);
    if (queryMatch?.[1]) {
      const code = normalizeAmbassadorCode(decodeURIComponent(queryMatch[1]));
      return isValidAmbassadorCodeShape(code) ? code : null;
    }

    return null;
  } catch {
    return null;
  }
}

module.exports = {
  CLIPBOARD_PREFIX,
  normalizeAmbassadorCode,
  isValidAmbassadorCodeShape,
  buildAmbassadorShareWebUrl,
  parseAmbassadorCodeFromClipboard,
  parseAmbassadorCodeFromReferrer,
  parseAmbassadorCodeFromUrl,
};
