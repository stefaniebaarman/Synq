import { Platform, Share } from "react-native";

function isShareDismissed(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return /cancel|dismiss/i.test(message);
}

/** Opens the native share sheet with a community join link. */
export async function shareCommunityJoinLink(
  shareWebUrl: string,
  groupName?: string
): Promise<void> {
  const url = shareWebUrl.trim();
  if (!url) {
    throw new Error("Community share link is not ready.");
  }

  const name = String(groupName || "").trim() || "this community";
  const message =
    Platform.OS === "ios"
      ? `Join ${name} on Synq\n${url}`
      : `Join ${name} on Synq\n${url}`;

  try {
    await Share.share(
      Platform.OS === "ios"
        ? { message, url }
        : { message, title: `Join ${name}` }
    );
  } catch (error) {
    if (isShareDismissed(error)) return;
    throw error;
  }
}
