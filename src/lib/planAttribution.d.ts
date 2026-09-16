export type PlanAttributionPerson = {
  userId: string | null;
  displayName: string;
  imageUrl?: string | null;
  isHost?: boolean;
  /** Viewer is attending and is not the host — shown like Host with a "You" label. */
  isYou?: boolean;
};

export function collectJoinedIds(event: unknown): string[];

export function resolveEffectiveHostUid(
  event: unknown,
  viewerUid?: string | null,
  joinedIds?: string[],
  profileSubjectUid?: string | null
): string;

export function resolvePlanAttribution(
  event: unknown,
  viewerUid?: string | null,
  hostDisplayNameByUid?: Record<string, string>,
  profileSubjectUid?: string | null,
  viewerEvents?: unknown[],
  friendIds?: string[]
): {
  primary: string | null;
  secondary: string | null;
  goingPeople: PlanAttributionPerson[];
};

export function resolvePlanHostUidForJoin(
  event: unknown,
  profileFriendUid?: string | null
): string;

export function planLooseMatch(a: unknown, b: unknown): boolean;

export function mergeEventsForGoingAttribution(
  primary: unknown,
  secondary?: unknown
): Record<string, unknown> | null | undefined;
