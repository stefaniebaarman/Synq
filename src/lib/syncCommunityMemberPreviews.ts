import { getFunctions, httpsCallable } from "firebase/functions";

export type CommunityMemberPreview = {
  displayName?: string;
  imageurl?: string;
};

type SyncResult = {
  memberPreviews: Record<string, CommunityMemberPreview>;
};

/**
 * Admin-backed sync of community member name/photo cards onto the group doc.
 * Any member can call this; avoids N client user getDocs that fail under rules budget.
 */
export async function syncCommunityMemberPreviews(
  groupId: string
): Promise<Record<string, CommunityMemberPreview>> {
  const id = String(groupId || "").trim();
  if (!id) return {};

  const functions = getFunctions(undefined, "us-central1");
  const fn = httpsCallable<{ groupId: string }, SyncResult>(
    functions,
    "syncCommunityMemberPreviews"
  );
  const result = await fn({ groupId: id });
  const previews = result.data?.memberPreviews;
  return previews && typeof previews === "object" ? previews : {};
}
