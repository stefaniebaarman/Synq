import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "./firebase";

const functions = getFunctions(app, "us-central1");

export type SearchUserResult = {
  id: string;
  displayName: string;
  imageurl?: string;
  email?: string | null;
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
