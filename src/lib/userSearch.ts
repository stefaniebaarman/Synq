import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "./firebase";

const functions = getFunctions(app, "us-central1");

export type SearchUserResult = {
  id: string;
  displayName: string;
  imageurl?: string;
  email?: string | null;
  city?: string;
  state?: string;
  locationDisplay?: string;
  interests?: string[];
  isFriend?: boolean;
};

export async function searchUsersForFriend(query: string): Promise<SearchUserResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const callable = httpsCallable<{ query: string }, { users: SearchUserResult[] }>(
    functions,
    "searchUsersForFriend"
  );
  const result = await callable({ query: trimmed });
  return result.data.users ?? [];
}

export type SuggestedFriend = SearchUserResult & { mutualCount?: number };

export async function fetchSuggestedFriends(): Promise<SuggestedFriend[]> {
  const callable = httpsCallable<Record<string, never>, { users: SuggestedFriend[] }>(
    functions,
    "getSuggestedFriends"
  );
  const result = await callable({});
  return result.data.users ?? [];
}

export type PublicProfilePreview = SearchUserResult;

export async function fetchPublicProfilePreview(
  uid: string
): Promise<PublicProfilePreview | null> {
  const trimmed = String(uid || "").trim();
  if (!trimmed) return null;
  const callable = httpsCallable<{ uid: string }, { user: PublicProfilePreview }>(
    functions,
    "getPublicProfilePreview"
  );
  const result = await callable({ uid: trimmed });
  return result.data.user ?? null;
}
