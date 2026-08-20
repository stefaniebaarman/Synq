import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";

import { auth, db } from "./firebase";
import { ownProfileCacheByUser } from "./ownProfileCache";

export const MAX_COMMUNITY_POST_BODY = 1000;
export const MAX_COMMUNITY_POST_LINK = 2048;

export type CommunityPostStatus = "pending" | "approved" | "rejected";

export type CommunityPost = {
  id: string;
  groupId: string;
  authorId: string;
  authorDisplayName: string;
  authorImageUrl?: string;
  body: string;
  linkUrl?: string;
  status: CommunityPostStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
  reviewedAt?: unknown;
  reviewedBy?: string;
};

export type CreateCommunityPostInput = {
  body: string;
  linkUrl?: string;
};

function communityPostsCollection(groupId: string) {
  return collection(db, "communityGroups", groupId, "posts");
}

export function communityPostRef(groupId: string, postId: string) {
  return doc(db, "communityGroups", groupId, "posts", postId);
}

function optionalTrimmed(value: unknown, maxLen: number): string | undefined {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLen);
}

function normalizeLinkUrl(raw: string | undefined): string | undefined {
  const trimmed = optionalTrimmed(raw, MAX_COMMUNITY_POST_LINK);
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[\w.-]+\.[\w.-]+(\/\S*)?$/i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

function mapPostDoc(groupId: string, id: string, data: Record<string, unknown>): CommunityPost {
  const statusRaw = String(data.status || "").trim();
  const status: CommunityPostStatus =
    statusRaw === "pending" || statusRaw === "rejected" || statusRaw === "approved"
      ? statusRaw
      : "approved";
  const authorImageUrl = optionalTrimmed(data.authorImageUrl, 2048);
  const linkUrl = optionalTrimmed(data.linkUrl, MAX_COMMUNITY_POST_LINK);
  const reviewedBy = optionalTrimmed(data.reviewedBy, 128);

  return {
    id,
    groupId,
    authorId: String(data.authorId || "").trim(),
    authorDisplayName: String(data.authorDisplayName || "").trim() || "Member",
    ...(authorImageUrl ? { authorImageUrl } : {}),
    body: String(data.body || "").trim(),
    ...(linkUrl ? { linkUrl } : {}),
    status,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    reviewedAt: data.reviewedAt,
    ...(reviewedBy ? { reviewedBy } : {}),
  };
}

function sortByCreatedDesc(a: CommunityPost, b: CommunityPost): number {
  const aMs =
    typeof (a.createdAt as { toMillis?: () => number } | undefined)?.toMillis === "function"
      ? (a.createdAt as { toMillis: () => number }).toMillis()
      : 0;
  const bMs =
    typeof (b.createdAt as { toMillis?: () => number } | undefined)?.toMillis === "function"
      ? (b.createdAt as { toMillis: () => number }).toMillis()
      : 0;
  return bMs - aMs || a.id.localeCompare(b.id);
}

export function subscribeApprovedCommunityPosts(
  groupId: string,
  onData: (posts: CommunityPost[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  if (!groupId) return () => {};
  // status-only query avoids a composite index; sort client-side.
  const q = query(communityPostsCollection(groupId), where("status", "==", "approved"));
  return onSnapshot(
    q,
    (snap) => {
      const posts = snap.docs
        .map((d) => mapPostDoc(groupId, d.id, d.data() as Record<string, unknown>))
        .sort(sortByCreatedDesc);
      onData(posts);
    },
    (err) => onError?.(err)
  );
}

export function subscribePendingCommunityPosts(
  groupId: string,
  onData: (posts: CommunityPost[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  if (!groupId) return () => {};
  const q = query(communityPostsCollection(groupId), where("status", "==", "pending"));
  return onSnapshot(
    q,
    (snap) => {
      const posts = snap.docs
        .map((d) => mapPostDoc(groupId, d.id, d.data() as Record<string, unknown>))
        .sort(sortByCreatedDesc);
      onData(posts);
    },
    (err) => onError?.(err)
  );
}

export function subscribeOwnPendingCommunityPosts(
  groupId: string,
  authorId: string,
  onData: (posts: CommunityPost[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  if (!groupId || !authorId) return () => {};
  const q = query(
    communityPostsCollection(groupId),
    where("authorId", "==", authorId),
    where("status", "==", "pending")
  );
  return onSnapshot(
    q,
    (snap) => {
      const posts = snap.docs
        .map((d) => mapPostDoc(groupId, d.id, d.data() as Record<string, unknown>))
        .sort(sortByCreatedDesc);
      onData(posts);
    },
    (err) => onError?.(err)
  );
}

export async function createCommunityPost(
  groupId: string,
  authorId: string,
  isAdmin: boolean,
  input: CreateCommunityPostInput
): Promise<string> {
  const body = String(input.body || "").trim();
  if (!body) {
    throw new Error("Write something to post.");
  }
  if (body.length > MAX_COMMUNITY_POST_BODY) {
    throw new Error(`Posts can be at most ${MAX_COMMUNITY_POST_BODY} characters.`);
  }

  const linkUrl = normalizeLinkUrl(input.linkUrl);
  const cached = ownProfileCacheByUser[authorId];
  let displayName =
    auth.currentUser?.uid === authorId
      ? String(auth.currentUser.displayName || "").trim()
      : "";
  if (!displayName) displayName = "Member";

  let imageUrl =
    optionalTrimmed(cached?.imageurl, 2048) ||
    (auth.currentUser?.uid === authorId
      ? optionalTrimmed(auth.currentUser.photoURL, 2048)
      : undefined);

  if (!imageUrl || !imageUrl.startsWith("http")) {
    try {
      const userSnap = await getDoc(doc(db, "users", authorId));
      if (userSnap.exists()) {
        const data = userSnap.data() as Record<string, unknown>;
        const fromDoc = optionalTrimmed(data.imageurl, 2048);
        if (fromDoc?.startsWith("http")) imageUrl = fromDoc;
        const nameFromDoc = optionalTrimmed(data.displayName, 80);
        if (nameFromDoc && displayName === "Member") displayName = nameFromDoc;
      }
    } catch {
      // Keep whatever we already resolved.
    }
  }
  if (imageUrl && !imageUrl.startsWith("http")) {
    imageUrl = undefined;
  }

  const ref = doc(communityPostsCollection(groupId));
  const status: CommunityPostStatus = isAdmin ? "approved" : "pending";

  await setDoc(ref, {
    groupId,
    authorId,
    authorDisplayName: displayName,
    ...(imageUrl ? { authorImageUrl: imageUrl } : {}),
    body,
    ...(linkUrl ? { linkUrl } : {}),
    status,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return ref.id;
}

export async function approveCommunityPost(
  groupId: string,
  postId: string,
  reviewerId: string
): Promise<void> {
  await updateDoc(communityPostRef(groupId, postId), {
    status: "approved",
    reviewedBy: reviewerId,
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function rejectCommunityPost(
  groupId: string,
  postId: string,
  reviewerId: string
): Promise<void> {
  await updateDoc(communityPostRef(groupId, postId), {
    status: "rejected",
    reviewedBy: reviewerId,
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteCommunityPost(groupId: string, postId: string): Promise<void> {
  await deleteDoc(communityPostRef(groupId, postId));
}

export function mergeFeedPosts(approved: CommunityPost[], extra: CommunityPost[]): CommunityPost[] {
  const byId = new Map<string, CommunityPost>();
  for (const post of [...approved, ...extra]) {
    byId.set(post.id, post);
  }
  return [...byId.values()].sort(sortByCreatedDesc);
}
