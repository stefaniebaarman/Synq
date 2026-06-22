import {
  ACCENT,
  BORDER_MUTED,
  MUTED,
  MUTED2,
  MUTED3,
  SURFACE_SUBTLE,
  TEXT,
  TEXT_MUTED_DARK,
  TEXT_MUTED_DARKER,
  TYPE_BODY,
  TYPE_FINE,
  TYPE_MICRO,
  cardMetaText,
  fonts,
  listRowTitleText,
} from "@/constants/Variables";
import {
  GROUP_BORDER,
  GROUP_SURFACE,
} from "@/src/components/friends/groupsListStyles";
import PlanGoingPeopleSheet, {
  type PlanGoingPerson,
} from "@/src/components/plans/PlanGoingPeopleSheet";
import type { FriendOpenPlanEvent } from "@/src/lib/friendOpenPlanJoin";
import type { AggregatedFriendPlan } from "@/src/lib/useFriendPlansFeed";
import { planLooseMatch, resolvePlanAttribution } from "@/src/lib/planAttribution";
import React, { useState } from "react";
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
  borderRadius: 12,
  borderWidth: 1,
  paddingHorizontal: 10,
  paddingVertical: 6,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  flexShrink: 0,
};

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
  onOpenPersonProfile?: (userId: string) => void;
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
}: Props) {
  const [goingSheetOpen, setGoingSheetOpen] = useState(false);
  const d = parsePlanDate(item.event.date);

  const viewerRow =
    joined && Array.isArray(viewerEvents)
      ? viewerEvents.find((row) => planLooseMatch(row, item.event))
      : undefined;
  const eventForAttribution = viewerRow || item.event;
  const profileSubject = joined ? viewerId : item.sourceFriendId;

  const { primary: hostLine, secondary: goingLine, goingPeople } = resolvePlanAttribution(
    eventForAttribution,
    viewerId,
    hostDisplayNameByUid,
    profileSubject,
    viewerEvents
  );
  const friendFirstName = item.sourceFriendName.trim().split(/\s+/)[0] || "Friend";
  const ownerLine =
    hostLine ||
    (isHost ? "Your plan" : `${friendFirstName}'s plan`);
  const peopleWithAvatars: PlanGoingPerson[] = goingPeople.map((person) => ({
    ...person,
    imageUrl: person.userId ? friendImageByUid[person.userId] ?? null : null,
  }));

  return (
    <>
      <View style={styles.card}>
        <Pressable style={styles.dateBlock} onPress={onPressCard}>
          <Text style={styles.day}>
            {d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}
          </Text>
          <Text style={styles.date}>{d.getDate()}</Text>
          <Text style={styles.month}>
            {d.toLocaleDateString("en-US", { month: "short" }).toUpperCase()}
          </Text>
        </Pressable>

        <View style={styles.planBody}>
          <View style={styles.planHeaderRow}>
            <Pressable
              style={styles.titlePress}
              onPress={onPressCard}
              accessibilityRole="button"
              accessibilityLabel={`${ownerLine}, ${item.event.title}`}
            >
              <Text style={styles.title} numberOfLines={2}>
                {item.event.title}
              </Text>
            </Pressable>
            {joined && !isHost ? (
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
          <Pressable onPress={onPressCard}>
            <Text style={styles.meta} numberOfLines={2}>
              {item.event.time}
              {item.event.location ? ` · ${item.event.location}` : ""}
            </Text>
            {!isHost ? (
              <Text style={styles.planOwnerLine} numberOfLines={1}>
                {ownerLine}
              </Text>
            ) : null}
          </Pressable>
          {goingLine ? (
            peopleWithAvatars.length > 0 ? (
              <TouchableOpacity
                onPress={() => setGoingSheetOpen(true)}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                accessibilityRole="button"
                accessibilityLabel="See everyone going to this plan"
                style={styles.goingPressable}
                activeOpacity={0.7}
              >
                <Text style={styles.goingText} numberOfLines={2}>
                  {goingLine}
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={[styles.goingText, styles.goingStatic]} numberOfLines={2}>
                {goingLine}
              </Text>
            )
          ) : null}
        </View>

        {isHost ? (
          <View style={[styles.hostPill, styles.planSidePill]}>
            <Text numberOfLines={1} style={[styles.interestText, styles.hostPillText]}>
              Your plan
            </Text>
          </View>
        ) : !joined ? (
          <TouchableOpacity
            style={[
              styles.interestPill,
              styles.planSidePill,
              { borderColor: ACCENT },
              busy && styles.actionBusy,
            ]}
            activeOpacity={0.85}
            disabled={busy}
            onPress={() => onPressAction()}
            accessibilityRole="button"
            accessibilityLabel="Join"
            accessibilityState={{ disabled: busy }}
          >
            <Text
              style={[
                styles.interestText,
                { color: ACCENT, fontFamily: fonts.heavy },
              ]}
            >
              Join
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <PlanGoingPeopleSheet
        visible={goingSheetOpen}
        planTitle={item.event.title}
        people={peopleWithAvatars}
        onClose={() => setGoingSheetOpen(false)}
        onPressPerson={
          onOpenPersonProfile
            ? (person) => {
                if (!person.userId || person.userId === viewerId) return;
                setGoingSheetOpen(false);
                onOpenPersonProfile(person.userId);
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
    borderRadius: 20,
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
  titlePress: {
    flex: 1,
    minWidth: 0,
  },
  cardAction: {
    flexShrink: 0,
    paddingTop: 1,
  },
  actionBusy: {
    opacity: 0.45,
  },
  day: {
    color: TEXT_MUTED_DARK,
    fontSize: TYPE_FINE,
  },
  date: {
    color: TEXT,
    fontSize: TYPE_BODY,
    fontFamily: fonts.heavy,
  },
  month: {
    color: TEXT_MUTED_DARK,
    fontSize: TYPE_FINE,
    marginTop: 2,
  },
  title: {
    flex: 1,
    minWidth: 0,
    ...listRowTitleText,
  },
  meta: {
    ...cardMetaText,
    color: TEXT_MUTED_DARKER,
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
  goingPressable: {
    alignSelf: "flex-start",
    marginTop: 4,
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
  interestPill: {
    ...PLAN_PILL_LAYOUT,
    borderColor: BORDER_MUTED,
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
    textAlign: "center",
    includeFontPadding: false,
  },
});
