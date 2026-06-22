import {
  ACCENT,
  BORDER_HAIRLINE,
  BORDER_MUTED,
  MUTED,
  MUTED2,
  MUTED3,
  SURFACE,
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
import { resolvePlanAttribution } from "@/src/lib/planAttribution";
import React, { useState } from "react";
import {
  ActivityIndicator,
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
  const { primary: hostLine, secondary: othersLine, goingPeople } = resolvePlanAttribution(
    item.event,
    viewerId,
    hostDisplayNameByUid,
    item.sourceFriendId,
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
      <Pressable
        style={styles.card}
        onPress={onPressCard}
        accessibilityRole="button"
        accessibilityLabel={`${ownerLine}, ${item.event.title}`}
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
          <Text style={styles.title} numberOfLines={2}>
            {item.event.title}
          </Text>
          <Text style={styles.meta} numberOfLines={2}>
            {item.event.time}
            {item.event.location ? ` · ${item.event.location}` : ""}
          </Text>
          {!isHost ? (
            <Text style={styles.planOwnerLine} numberOfLines={1}>
              {ownerLine}
            </Text>
          ) : null}
          {othersLine && peopleWithAvatars.length > 0 ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                setGoingSheetOpen(true);
              }}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              accessibilityRole="button"
              accessibilityLabel="See everyone going to this plan"
              style={styles.goingPressable}
            >
              <Text style={styles.goingText} numberOfLines={2}>
                {othersLine}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {isHost ? (
          <View style={[styles.hostPill, styles.planSidePill]}>
            <Text numberOfLines={1} style={[styles.interestText, styles.hostPillText]}>
              Your plan
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.interestPill,
              styles.planSidePill,
              joined
                ? { borderColor: BORDER_HAIRLINE, backgroundColor: SURFACE }
                : { borderColor: ACCENT },
            ]}
            activeOpacity={0.85}
            disabled={busy}
            onPress={(e) => {
              e.stopPropagation?.();
              onPressAction();
            }}
            accessibilityRole="button"
            accessibilityLabel={joined ? "Added" : "Add"}
            accessibilityState={{ selected: joined, disabled: busy }}
          >
            {busy ? (
              <ActivityIndicator size="small" color={ACCENT} />
            ) : (
              <Text
                style={[
                  styles.interestText,
                  {
                    color: joined ? MUTED2 : ACCENT,
                    fontFamily: joined ? fonts.medium : fonts.heavy,
                  },
                ]}
              >
                {joined ? "Added" : "Add"}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </Pressable>

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
  planSidePill: {
    alignSelf: "center",
    marginLeft: 4,
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
