import {
  ACCENT,
  cardMetaText,
  fonts,
  listRowTitleText,
  MUTED,
  MUTED2,
  MUTED3,
  RADIUS_LG,
  SURFACE_SUBTLE,
  SYNQ_OUTLINE_CTA_RADIUS,
  synqOutlineAddBtnCompact,
  synqOutlineAddBtnTextCompact,
  TEXT,
  TYPE_BODY,
  TYPE_FINE,
  TYPE_MICRO
} from "@/constants/Variables";
import {
  GROUP_BORDER,
  GROUP_SURFACE,
} from "@/src/components/friends/groupsListStyles";
import PlanGoingPeopleSheet, {
  type PlanGoingPerson,
} from "@/src/components/plans/PlanGoingPeopleSheet";
import type { FriendOpenPlanEvent } from "@/src/lib/friendOpenPlanJoin";
import { mergeEventsForGoingAttribution, planLooseMatch, resolvePlanAttribution } from "@/src/lib/planAttribution";
import type { AggregatedFriendPlan } from "@/src/lib/useFriendPlansFeed";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const PLAN_PILL_LAYOUT = {
  minWidth: 88,
  minHeight: 32,
  borderRadius: SYNQ_OUTLINE_CTA_RADIUS,
  borderWidth: 1,
  paddingHorizontal: 10,
  paddingVertical: 6,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  flexShrink: 0,
};

const PLAN_CARD_OWNER_LOGIC_VERSION = 5; // bump forces Metro to pick up owner-line fixes

function parsePlanDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

type Props = {
  item: AggregatedFriendPlan;
  viewerId: string;
  hostDisplayNameByUid: Record<string, string>;
  friendImageByUid?: Record<string, string | null>;
  viewerEvents?: FriendOpenPlanEvent[];
  joined: boolean;
  isHost: boolean;
  busy: boolean;
  onPressCard: () => void;
  onPressAction: () => void;
  onOpenPersonProfile?: (
    userId: string,
    preview?: { displayName?: string; imageUrl?: string | null }
  ) => void;
  /** When true, tapping the card opens the going list instead of onPressCard. */
  cardPressOpensGoing?: boolean;
};

export default function FriendPlanCard({
  item,
  viewerId,
  hostDisplayNameByUid,
  friendImageByUid = {},
  viewerEvents,
  joined,
  isHost,
  busy,
  onPressCard,
  onPressAction,
  onOpenPersonProfile,
  cardPressOpensGoing = false,
}: Props) {
  void PLAN_CARD_OWNER_LOGIC_VERSION;
  const [goingSheetOpen, setGoingSheetOpen] = useState(false);
  const reopenGoingOnFocusRef = useRef(false);
  const pendingProfileRef = useRef<{
    uid: string;
    displayName?: string;
    imageUrl?: string | null;
  } | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!reopenGoingOnFocusRef.current) return;
      reopenGoingOnFocusRef.current = false;
      setGoingSheetOpen(true);
    }, [])
  );

  const d = parsePlanDate(item.event.date);
  const viewerKey = String(viewerId || "").trim();

  // If the viewer's own calendar says they host this plan, that wins over everything
  // else (friend-cache / offline persistence can still say William).
  const viewerHostsThisPlan = !!(
    viewerKey &&
    Array.isArray(viewerEvents) &&
    viewerEvents.some(
      (row) =>
        planLooseMatch(row, item.event) &&
        String(row?.planHostUid || "").trim() === viewerKey
    )
  );

  // (join keys can lag; stale friend-cache rows may still have the wrong planHostUid).
  const viewerRow = Array.isArray(viewerEvents)
    ? viewerEvents.find((row) => planLooseMatch(row, item.event))
    : undefined;
  const baseEvent = viewerHostsThisPlan
    ? { ...item.event, planHostUid: viewerKey }
    : viewerRow && String(viewerRow.planHostUid || "").trim() === viewerKey
      ? { ...item.event, planHostUid: viewerKey, joinedFromFriendUid: undefined }
      : item.event;
  const eventForAttribution = mergeEventsForGoingAttribution(
    viewerRow || baseEvent,
    viewerRow ? baseEvent : undefined
  );
  const profileSubject = item.sourceFriendId;

  const { primary: hostLine, secondary: goingLine, goingPeople } = resolvePlanAttribution(
    eventForAttribution,
    viewerId,
    hostDisplayNameByUid,
    profileSubject,
    viewerEvents
  );
  const friendFirstName = item.sourceFriendName.trim().split(/\s+/)[0] || "Friend";

  // Owner label MUST match the going-sheet host (same goingPeople list). Separate
  // heuristics were still showing "William's plan" while the sheet correctly marked
  // Stefanie as Host.
  const hostPerson =
    goingPeople.find((p) => p.isHost) ||
    (goingPeople.length > 0 ? goingPeople[0] : null);
  const hostPersonId = String(hostPerson?.userId || "").trim();
  const hostPersonFirst =
    String(hostPerson?.displayName || "")
      .trim()
      .split(/\s+/)[0] || "";
  const viewerOwnsPlan = !!(
    viewerHostsThisPlan ||
    (hostPersonId && viewerKey && hostPersonId === viewerKey) ||
    isHost
  );
  const ownerLine = viewerOwnsPlan
    ? "Your plan"
    : hostPersonFirst
      ? `${hostPersonFirst}'s plan`
      : hostLine || `${friendFirstName}'s plan`;
  const peopleWithAvatars: PlanGoingPerson[] = goingPeople.map((person) => {
    const uid = String(person.userId || "").trim();
    const fromFriends = uid ? friendImageByUid[uid] ?? null : null;
    const images =
      eventForAttribution &&
      typeof eventForAttribution.attendeeImages === "object" &&
      eventForAttribution.attendeeImages
        ? (eventForAttribution.attendeeImages as Record<string, string>)
        : null;
    const fromEvent = uid && images ? String(images[uid] || "").trim() || null : null;
    return {
      ...person,
      imageUrl: fromFriends || fromEvent,
    };
  });

  const handleCardPress = () => {
    if (cardPressOpensGoing) {
      setGoingSheetOpen(true);
      return;
    }
    onPressCard();
  };

  return (
    <>
      <Pressable
        style={styles.card}
        onPress={handleCardPress}
        accessibilityRole="button"
        accessibilityLabel={
          cardPressOpensGoing
            ? `See who's going to ${item.event.title}`
            : `${ownerLine}, ${item.event.title}`
        }
      >
        <View style={styles.dateBlock}>
          <Text style={styles.day}>
            {d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}
          </Text>
          <Text style={styles.date}>{d.getDate()}</Text>
          <Text style={styles.month}>
            {d.toLocaleDateString("en-US", { month: "short" }).toUpperCase()}
          </Text>
        </View>

        <View style={styles.planBody}>
          <View style={styles.planHeaderRow}>
            <Text style={styles.title} numberOfLines={2}>
              {item.event.title}
            </Text>
            {joined && !viewerOwnsPlan ? (
              <TouchableOpacity
                style={[styles.cardAction, busy && styles.actionBusy]}
                disabled={busy}
                activeOpacity={0.7}
                onPress={() => onPressAction()}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                accessibilityRole="button"
                accessibilityLabel="Remove this plan from your open plans"
                accessibilityState={{ disabled: busy }}
              >
                <Text style={styles.removeText}>Remove</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <Text style={styles.meta} numberOfLines={2}>
            {item.event.location
              ? `${item.event.location}${item.event.time ? ` · ${item.event.time}` : ""}`
              : item.event.time}
          </Text>
          {!viewerOwnsPlan ? (
            <Text style={styles.planOwnerLine} numberOfLines={1}>
              {ownerLine}
            </Text>
          ) : null}
          {goingLine ? (
            <Text style={[styles.goingText, styles.goingStatic]} numberOfLines={2}>
              {goingLine}
            </Text>
          ) : null}
        </View>

        {viewerOwnsPlan ? (
          <View style={[styles.hostPill, styles.planSidePill]}>
            <Text numberOfLines={1} style={[styles.interestText, styles.hostPillText]}>
              Your plan
            </Text>
          </View>
        ) : !joined ? (
          <TouchableOpacity
            style={[
              synqOutlineAddBtnCompact,
              styles.planSidePill,
              busy && styles.actionBusy,
            ]}
            activeOpacity={0.85}
            disabled={busy}
            onPress={() => onPressAction()}
            accessibilityRole="button"
            accessibilityLabel="Join"
            accessibilityState={{ disabled: busy }}
          >
            <Text style={synqOutlineAddBtnTextCompact}>Join</Text>
          </TouchableOpacity>
        ) : null}
      </Pressable>

      <PlanGoingPeopleSheet
        visible={goingSheetOpen}
        planTitle={item.event.title}
        people={peopleWithAvatars}
        viewerId={viewerId}
        onClose={() => {
          pendingProfileRef.current = null;
          reopenGoingOnFocusRef.current = false;
          setGoingSheetOpen(false);
        }}
        onClosed={() => {
          const pending = pendingProfileRef.current;
          pendingProfileRef.current = null;
          if (pending?.uid && onOpenPersonProfile) {
            onOpenPersonProfile(pending.uid, {
              displayName: pending.displayName,
              imageUrl: pending.imageUrl,
            });
          }
        }}
        onPressPerson={
          onOpenPersonProfile
            ? (person) => {
                const uid = String(person.userId || "").trim();
                if (!uid || uid === viewerId) return;
                pendingProfileRef.current = {
                  uid,
                  displayName: person.displayName,
                  imageUrl: person.imageUrl,
                };
                reopenGoingOnFocusRef.current = true;
                setGoingSheetOpen(false);
              }
            : undefined
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    backgroundColor: GROUP_SURFACE,
    borderRadius: RADIUS_LG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GROUP_BORDER,
    padding: 14,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "stretch",
  },
  dateBlock: {
    width: 48,
    flexShrink: 0,
    alignItems: "center",
    marginRight: 12,
    alignSelf: "stretch",
    justifyContent: "center",
  },
  planBody: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    alignSelf: "stretch",
    justifyContent: "flex-start",
    paddingRight: 10,
  },
  planHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  planSidePill: {
    alignSelf: "center",
    marginLeft: 4,
    flexShrink: 0,
  },
  cardAction: {
    flexShrink: 0,
    paddingTop: 1,
  },
  actionBusy: {
    opacity: 0.45,
  },
  day: {
    color: MUTED2,
    fontSize: TYPE_FINE,
    fontFamily: fonts.book,
  },
  date: {
    color: TEXT,
    fontSize: TYPE_BODY,
    fontFamily: fonts.heavy,
  },
  month: {
    color: MUTED2,
    fontSize: TYPE_FINE,
    fontFamily: fonts.book,
    marginTop: 2,
  },
  title: {
    flex: 1,
    minWidth: 0,
    ...listRowTitleText,
  },
  meta: {
    ...cardMetaText,
    marginTop: 3,
  },
  planOwnerLine: {
    ...cardMetaText,
    fontSize: TYPE_FINE,
    color: MUTED3,
    marginTop: 5,
    fontFamily: fonts.medium,
    letterSpacing: 0.1,
  },
  goingText: {
    color: ACCENT,
    fontSize: TYPE_MICRO,
    fontFamily: fonts.medium,
    letterSpacing: 0.05,
    lineHeight: 15,
  },
  goingStatic: {
    marginTop: 4,
    alignSelf: "flex-start",
  },
  removeText: {
    color: MUTED3,
    fontSize: TYPE_FINE,
    fontFamily: fonts.medium,
    includeFontPadding: false,
  },
  hostPill: {
    ...PLAN_PILL_LAYOUT,
    borderColor: MUTED3,
    backgroundColor: SURFACE_SUBTLE,
  },
  hostPillText: {
    color: MUTED,
  },
  interestText: {
    fontSize: TYPE_FINE,
    fontFamily: fonts.medium,
    color: MUTED,
    textAlign: "center",
    includeFontPadding: false,
  },
});
