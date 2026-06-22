import {
  BORDER_HAIRLINE,
  MUTED,
  MUTED2,
  MUTED3,
  SURFACE,
  SURFACE_SUBTLE,
  TEXT,
  TEXT_MUTED_DARK,
  TEXT_MUTED_DARKER,
  TYPE_BUTTON,
  TYPE_CAPTION,
  TYPE_CTA,
  TYPE_FINE,
  TYPE_LEAD,
  fonts,
} from "@/constants/Variables";
import { filterOutPastOpenPlans, sortOpenPlansByDateTime } from "@/src/lib/planEvents";
import { resolvePlanAttribution } from "@/src/lib/planAttribution";
import {
  GROUP_BORDER,
  GROUP_SURFACE,
} from "@/src/components/friends/groupsListStyles";
import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from "react-native";

const PLAN_PILL_LAYOUT: ViewStyle = {
  marginLeft: "auto",
  minWidth: 88,
  minHeight: 32,
  borderRadius: 12,
  borderWidth: 1,
  paddingHorizontal: 10,
  paddingVertical: 6,
  alignItems: "center",
  justifyContent: "center",
};

type EventItem = {
  id: string;
  date: string;
  title: string;
  time?: string;
  location?: string;
  joinedFromFriendUid?: string;
  joinedFromId?: string;
  joinedFromIds?: string[];
  joinedFromName?: string;
  joinedFromNames?: string[];
  planHostUid?: string;
  attendeeDisplayNames?: Record<string, string>;
};

type Props = {
  events: EventItem[];
  ACCENT: string;
  fonts: any;
  viewerUid?: string;
  profileSubjectUid?: string;
  onPressPlan?: (event: EventItem) => void;
  isPlanJoined?: (event: EventItem) => boolean;
  isViewerHostOfPlan?: (event: EventItem) => boolean;
  hostDisplayNameByUid: Record<string, string>;
  profileFallbackFirstName?: string;
};

export default function FriendOpenPlans({
  events,
  ACCENT,
  fonts,
  viewerUid = "",
  profileSubjectUid = "",
  onPressPlan,
  isPlanJoined,
  isViewerHostOfPlan,
  hostDisplayNameByUid,
}: Props) {
  const visibleEvents = useMemo(
    () => sortOpenPlansByDateTime(filterOutPastOpenPlans(events)),
    [events]
  );

  const parseDate = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  };

  const planHostLabelForRow = (p: EventItem) => {
    const { primary } = resolvePlanAttribution(
      p,
      viewerUid,
      hostDisplayNameByUid,
      profileSubjectUid || viewerUid
    );
    return primary;
  };

  return (
    <View style={styles.container}>
      {visibleEvents.length === 0 && (
        <Text style={styles.empty}>
          Nothing planned right now 👀
        </Text>
      )}

      {visibleEvents.map((p) => {
        const d = parseDate(p.date);
        const canJoin = typeof onPressPlan === "function";
        const joined = isPlanJoined?.(p) ?? false;
        const isHost = isViewerHostOfPlan?.(p) ?? false;
        const rowHostLabel = planHostLabelForRow(p);
        const hasInterestLine = !!rowHostLabel;

        return (
          <View key={p.id} style={styles.card}>
            <View style={styles.dateBlock}>
              <Text style={styles.day}>
                {d
                  .toLocaleDateString("en-US", { weekday: "short" })
                  .toUpperCase()}
              </Text>
              <Text style={styles.date}>{d.getDate()}</Text>
              <Text style={styles.month}>
                {d
                  .toLocaleDateString("en-US", { month: "short" })
                  .toUpperCase()}
              </Text>
            </View>

            <View
              style={[
                styles.planBody,
                hasInterestLine && styles.planBodyWithInterest,
              ]}
            >
              <Text style={[styles.title, { fontFamily: fonts.medium }]}>
                {p.title}
              </Text>
              <Text style={styles.meta}>
                {p.time}
                {p.location ? ` · ${p.location}` : ""}
              </Text>
              {rowHostLabel ? (
                <Text style={[styles.planOwnerLine, { fontFamily: fonts.medium }]}>
                  {rowHostLabel}
                </Text>
              ) : null}
            </View>
            {isHost ? (
              <View style={[styles.hostPill, styles.planSidePill]}>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.interestText,
                    styles.hostPillText,
                    { fontFamily: fonts.medium },
                  ]}
                >
                  Your plan
                </Text>
              </View>
            ) : (
              canJoin && (
                <TouchableOpacity
                  style={[
                    styles.interestPill,
                    styles.planSidePill,
                    joined
                      ? {
                          borderColor: BORDER_HAIRLINE,
                          backgroundColor: SURFACE,
                        }
                      : { borderColor: ACCENT },
                  ]}
                  activeOpacity={0.85}
                  onPress={() => onPressPlan?.(p)}
                  accessibilityRole="button"
                  accessibilityLabel={joined ? "Added" : "Add"}
                  accessibilityHint={
                    joined
                      ? "Tap to remove this plan from your open plans."
                      : "Adds this plan to your open plans and notifies your friend."
                  }
                  accessibilityState={{ selected: joined }}
                >
                  <Text
                    style={[
                      styles.interestText,
                      {
                        color: joined ? "rgba(255,255,255,0.48)" : ACCENT,
                        fontFamily: joined ? fonts.medium : fonts.heavy,
                      },
                    ]}
                  >
                    {joined ? "Added" : "Add"}
                  </Text>
                </TouchableOpacity>
              )
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "92%",
    alignItems: "flex-start",
  },
  header: {
    color: TEXT,
    fontSize: TYPE_CTA,
    marginBottom: 14,
  },
  empty: {
    color: TEXT_MUTED_DARK,
    fontSize: TYPE_LEAD,
    marginBottom: 20
  },
  card: {
    alignSelf: "flex-start",
    width: "100%",
    maxWidth: 340,
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
    alignItems: "center",
    marginRight: 12,
    alignSelf: "stretch",
    justifyContent: "center",
  },
  planBody: {
    flex: 1,
    alignSelf: "stretch",
    justifyContent: "center",
  },
  planBodyWithInterest: {
    justifyContent: "flex-start",
  },
  planSidePill: {
    alignSelf: "center",
  },

  day: {
    color: TEXT_MUTED_DARK,
    fontSize: TYPE_FINE,
  },

  date: {
    color: TEXT,
    fontSize: TYPE_CTA,
    fontFamily: fonts.heavy,
  },

  month: {
    color: TEXT_MUTED_DARK,
    fontSize: TYPE_FINE,
    marginTop: 2,
  },

  title: {
    color: TEXT,
    fontSize: TYPE_BUTTON,
  },

  meta: {
    color: TEXT_MUTED_DARKER,
    marginTop: 3,
    fontSize: TYPE_CAPTION,
  },

  planOwnerLine: {
    color: MUTED2,
    fontSize: TYPE_FINE,
    marginTop: 5,
  },

  interestPill: {
    ...PLAN_PILL_LAYOUT,
    borderColor: "#333",
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
