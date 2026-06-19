/** Server-side copy of isRecipientInSynqVisibleTo (keep in sync with src/lib/synqBroadcastCore.js). */

function isRecipientInSynqVisibleTo(recipientId, activatedUserData) {
  const mode = String(activatedUserData?.synqBroadcastMode ?? "all");
  if (mode !== "groups") return true;
  const visible = activatedUserData?.synqVisibleTo;
  if (!Array.isArray(visible)) return true;
  return visible.some((id) => String(id) === String(recipientId));
}

module.exports = { isRecipientInSynqVisibleTo };
