import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Contacts from "expo-contacts";
import { FirebaseError } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app, auth } from "./firebase";

const functions = getFunctions(app, "us-central1");

const MATCH_CHUNK = 150;
/** Persist contact matches across app launches so daily opens do not re-scan. */
const CONTACTS_MATCH_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** After this age, show cache instantly then refresh matches in the background. */
const CONTACTS_MATCH_SOFT_REFRESH_MS = 60 * 60 * 1000;
const CONTACTS_MATCH_CACHE_KEY_PREFIX = "synq:contactsMatch:v1:";

export type ContactMatchUser = {
  id: string;
  displayName: string;
  imageurl?: string | null;
  phone?: string | null;
};

export type ContactInvitee = {
  key: string;
  name: string;
  phone: string;
};

export type ContactsMatchResult = {
  matches: ContactMatchUser[];
  invitees: ContactInvitee[];
  permission: Contacts.PermissionStatus;
  /** Non-fatal warning (e.g. matching failed but contacts loaded). */
  warning?: string;
};

type ContactsMatchCache = {
  uid: string;
  fetchedAt: number;
  result: ContactsMatchResult;
};

let contactsMatchCache: ContactsMatchCache | null = null;
let hydrateInFlight: Promise<ContactsMatchResult | null> | null = null;

function contactsMatchStorageKey(uid: string) {
  return `${CONTACTS_MATCH_CACHE_KEY_PREFIX}${uid}`;
}

function isFresh(fetchedAt: number) {
  return Date.now() - fetchedAt <= CONTACTS_MATCH_CACHE_TTL_MS;
}

function currentUid(): string | null {
  return auth.currentUser?.uid ?? null;
}

async function persistContactsMatchCache(entry: ContactsMatchCache) {
  try {
    await AsyncStorage.setItem(contactsMatchStorageKey(entry.uid), JSON.stringify(entry));
  } catch {
    // Disk cache is best-effort.
  }
}

function writeContactsMatchCache(result: ContactsMatchResult) {
  const uid = currentUid();
  if (!uid) return;
  const entry: ContactsMatchCache = {
    uid,
    fetchedAt: Date.now(),
    result: { ...result, warning: undefined },
  };
  contactsMatchCache = entry;
  void persistContactsMatchCache(entry);
}

export function clearContactsMatchCache() {
  const uid = contactsMatchCache?.uid ?? currentUid();
  contactsMatchCache = null;
  if (!uid) return;
  void AsyncStorage.removeItem(contactsMatchStorageKey(uid)).catch(() => {});
}

export function getCachedContactsMatch(): ContactsMatchResult | null {
  const uid = currentUid();
  if (!contactsMatchCache || !uid || contactsMatchCache.uid !== uid) return null;
  if (!isFresh(contactsMatchCache.fetchedAt)) {
    contactsMatchCache = null;
    return null;
  }
  return contactsMatchCache.result;
}

/** True when cached results are old enough to refresh quietly in the background. */
export function shouldSoftRefreshContactsMatch(): boolean {
  const uid = currentUid();
  if (!contactsMatchCache || !uid || contactsMatchCache.uid !== uid) return true;
  if (!isFresh(contactsMatchCache.fetchedAt)) return true;
  return Date.now() - contactsMatchCache.fetchedAt >= CONTACTS_MATCH_SOFT_REFRESH_MS;
}

/** Load persisted matches into memory so reopen after app kill stays instant. */
export async function hydrateContactsMatchCache(): Promise<ContactsMatchResult | null> {
  const mem = getCachedContactsMatch();
  if (mem) return mem;

  const uid = currentUid();
  if (!uid) return null;

  if (hydrateInFlight) return hydrateInFlight;

  hydrateInFlight = (async () => {
    try {
      const raw = await AsyncStorage.getItem(contactsMatchStorageKey(uid));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as ContactsMatchCache;
      if (
        !parsed ||
        (parsed.uid && parsed.uid !== uid) ||
        typeof parsed.fetchedAt !== "number" ||
        !parsed.result ||
        !isFresh(parsed.fetchedAt)
      ) {
        void AsyncStorage.removeItem(contactsMatchStorageKey(uid)).catch(() => {});
        return null;
      }
      contactsMatchCache = {
        uid,
        fetchedAt: parsed.fetchedAt,
        result: {
          matches: Array.isArray(parsed.result.matches) ? parsed.result.matches : [],
          invitees: Array.isArray(parsed.result.invitees) ? parsed.result.invitees : [],
          permission: parsed.result.permission,
        },
      };
      return contactsMatchCache.result;
    } catch {
      return null;
    } finally {
      hydrateInFlight = null;
    }
  })();

  return hydrateInFlight;
}

function readFreshCache(): ContactsMatchResult | null {
  return getCachedContactsMatch();
}

/** Normalize to E.164-ish form aligned with server + US phone signup. */
export function normalizePhoneE164(raw: string): string | null {
  const cleaned = String(raw || "").trim();
  if (!cleaned) return null;
  const digits = cleaned.replace(/\D/g, "");
  if (!digits) return null;

  if (cleaned.startsWith("+")) {
    if (digits.length < 8 || digits.length > 15) return null;
    return `+${digits}`;
  }
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

function contactsErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err || "");
  const code =
    err instanceof FirebaseError
      ? err.code
      : typeof (err as { code?: string })?.code === "string"
        ? (err as { code: string }).code
        : "";

  if (
    /ExpoContacts|native module|Cannot find native/i.test(message) ||
    code === "ERR_CONTACTMODULE_UNDEFINED"
  ) {
    return "Contacts need a development or production build of Synq (not Expo Go).";
  }
  if (code === "functions/not-found") {
    return "Contact matching isn’t deployed yet. Try again after updating the app’s backend.";
  }
  if (code === "functions/resource-exhausted") {
    return "Too many contact scans for now. Your last results are saved — try again later.";
  }
  if (code === "functions/unauthenticated") {
    return "Sign in again to find friends from contacts.";
  }
  if (code === "functions/unavailable" || /503|unavailable/i.test(message)) {
    return "Contact matching is temporarily unavailable. You can still invite friends below.";
  }
  if (/permission/i.test(message)) {
    return "Contacts permission is required to find friends on Synq.";
  }
  if (message.trim()) return message.trim();
  return "Could not read contacts right now. Please try again.";
}

export async function syncMyPhoneHash(): Promise<{ ok: boolean; hasPhone: boolean }> {
  const callable = httpsCallable<Record<string, never>, { ok: boolean; hasPhone: boolean }>(
    functions,
    "syncMyPhoneHash"
  );
  const result = await callable({});
  return result.data;
}

async function matchContactsChunk(phones: string[]): Promise<ContactMatchUser[]> {
  const callable = httpsCallable<{ phones: string[] }, { users: ContactMatchUser[] }>(
    functions,
    "matchContacts"
  );
  const result = await callable({ phones });
  return result.data.users ?? [];
}

export async function requestContactsPermission(): Promise<Contacts.PermissionResponse> {
  return Contacts.requestPermissionsAsync();
}

export async function getContactsPermission(): Promise<Contacts.PermissionResponse> {
  return Contacts.getPermissionsAsync();
}

type LoadedContact = {
  key: string;
  name: string;
  phone: string;
};

async function loadNormalizedContacts(): Promise<LoadedContact[]> {
  const { data } = await Contacts.getContactsAsync({
    fields: [
      Contacts.Fields.PhoneNumbers,
      Contacts.Fields.Name,
      Contacts.Fields.FirstName,
      Contacts.Fields.LastName,
    ],
    pageSize: 2000,
  });

  const out: LoadedContact[] = [];
  const seenPhones = new Set<string>();

  for (const contact of data || []) {
    const name =
      String(contact.name || "").trim() ||
      [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim() ||
      "Contact";
    const numbers = contact.phoneNumbers || [];
    for (const entry of numbers) {
      const phone = normalizePhoneE164(String(entry.number || entry.digits || ""));
      if (!phone || seenPhones.has(phone)) continue;
      seenPhones.add(phone);
      out.push({
        key: `${contact.id || name}:${phone}`,
        name,
        phone,
      });
    }
  }

  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

/**
 * Request/check permission, load device contacts, match against Synq phone accounts.
 * Results are persisted for 30 days; the UI may soft-refresh in the background when stale.
 */
export async function findFriendsFromContacts(options?: {
  force?: boolean;
}): Promise<ContactsMatchResult> {
  if (!options?.force) {
    const cached = readFreshCache() ?? (await hydrateContactsMatchCache());
    if (cached) return cached;
  }

  let permission: Contacts.PermissionResponse;
  try {
    permission = await getContactsPermission();
    if (permission.status !== "granted") {
      permission = await requestContactsPermission();
    }
  } catch (err) {
    throw new Error(contactsErrorMessage(err));
  }

  if (permission.status !== "granted") {
    return {
      matches: [],
      invitees: [],
      permission: permission.status,
    };
  }

  try {
    await syncMyPhoneHash();
  } catch {
    // Matching still works for others even if self sync fails.
  }

  let contacts: LoadedContact[];
  try {
    contacts = await loadNormalizedContacts();
  } catch (err) {
    throw new Error(contactsErrorMessage(err));
  }

  if (contacts.length === 0) {
    const empty: ContactsMatchResult = {
      matches: [],
      invitees: [],
      permission: permission.status,
    };
    writeContactsMatchCache(empty);
    return empty;
  }

  const phones = contacts.map((c) => c.phone);
  const matchedUsers: ContactMatchUser[] = [];
  const matchedPhones = new Set<string>();
  let warning: string | undefined;

  try {
    for (let i = 0; i < phones.length; i += MATCH_CHUNK) {
      const chunk = phones.slice(i, i + MATCH_CHUNK);
      const users = await matchContactsChunk(chunk);
      for (const user of users) {
        matchedUsers.push(user);
        if (user.phone) matchedPhones.add(user.phone);
      }
    }
  } catch (err) {
    // Still show invite list if server matching fails.
    warning = contactsErrorMessage(err);
  }

  const byId = new Map<string, ContactMatchUser>();
  for (const user of matchedUsers) {
    if (!byId.has(user.id)) byId.set(user.id, user);
  }
  const matches = [...byId.values()].sort((a, b) =>
    String(a.displayName || "").localeCompare(String(b.displayName || ""))
  );

  const invitees = contacts
    .filter((c) => !matchedPhones.has(c.phone))
    .slice(0, 100);

  const result: ContactsMatchResult = {
    matches,
    invitees,
    permission: permission.status,
    warning,
  };
  if (!warning) {
    writeContactsMatchCache(result);
  }
  return result;
}
