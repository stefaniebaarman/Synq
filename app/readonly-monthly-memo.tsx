import {
  cardMetaText,
  cardTitleText,
  fonts,
  MUTED,
  MUTED2,
  MUTED3,
  RADIUS_LG,
  RADIUS_SM,
  SURFACE_SUBTLE,
  TEXT,
  TEXT_MUTED_DARK,
  TEXT_MUTED_DARKER,
  TYPE_CTA,
  TYPE_FINE,
  TYPE_LEAD,
  TYPE_MICRO,
  TYPE_NANO,
  TYPE_SECTION,
  synqOutlineAddBtnCompact,
  synqOutlineAddBtnDisabled,
  synqOutlineAddBtnTextCompact,
  synqOutlineAddBtnTextDisabled,
} from "@/constants/Variables";
import {
  GROUP_BORDER,
  GROUP_SURFACE,
} from "@/src/components/friends/groupsListStyles";
import { resolvePlanAttribution } from "@/src/lib/planAttribution";
import { filterOutPastOpenPlans, sortOpenPlansByDateTime } from "@/src/lib/planEvents";
import { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from "react-native";

const PLAN_PILL_LAYOUT: ViewStyle = {
  minWidth: 88,
  minHeight: 32,
  borderRadius: RADIUS_SM,
  borderWidth: 1,
  paddingHorizontal: 10,
  paddingVertical: 6,
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
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
  attendeeImages?: Record<string, string>;
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
  viewerEvents?: EventItem[];
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
  viewerEvents,
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
      profileSubjectUid || viewerUid,
      viewerEvents
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

            <View style={styles.planBody}>
              <Text style={styles.title} numberOfLines={2}>
                {p.title}
              </Text>
              <Text style={styles.meta} numberOfLines={2}>
                {p.time}
                {p.location ? ` · ${p.location}` : ""}
              </Text>
              {rowHostLabel ? (
                <Text style={styles.planOwnerLine} numberOfLines={1}>
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
                  ]}
                >
                  Your plan
                </Text>
              </View>
            ) : (
              canJoin && (
                <TouchableOpacity
                  style={[
                    synqOutlineAddBtnCompact,
                    styles.planSidePill,
                    joined && synqOutlineAddBtnDisabled,
                  ]}
                  activeOpacity={0.85}
                  onPress={() => onPressPlan?.(p)}
                  accessibilityRole="button"
                  accessibilityLabel={joined ? "Added" : "Add"}
                  accessibilityHint={
                    joined
                      ? "Tap to remove this plan from your plans."
                      : "Adds this plan to your plans and notifies your friend."
                  }
                  accessibilityState={{ selected: joined }}
                >
                  <Text
                    style={[
                      synqOutlineAddBtnTextCompact,
                      joined && synqOutlineAddBtnTextDisabled,
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
    borderRadius: RADIUS_LG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GROUP_BORDER,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
  },

  dateBlock: {
    width: 44,
    flexShrink: 0,
    alignItems: "center",
    marginRight: 12,
  },
  planBody: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    paddingRight: 10,
  },
  planSidePill: {
    alignSelf: "center",
    marginLeft: 4,
  },

  day: {
    color: MUTED3,
    fontSize: TYPE_NANO,
    fontFamily: fonts.medium,
    letterSpacing: 0.5,
  },

  date: {
    color: TEXT,
    fontSize: TYPE_SECTION,
    fontFamily: fonts.heavy,
    lineHeight: 24,
    letterSpacing: -0.5,
    marginTop: 2,
  },

  month: {
    color: MUTED3,
    fontSize: TYPE_NANO,
    fontFamily: fonts.medium,
    letterSpacing: 0.4,
    marginTop: 2,
  },

  title: {
    ...cardTitleText,
  },

  meta: {
    ...cardMetaText,
    color: TEXT_MUTED_DARKER,
    marginTop: 5,
    lineHeight: 18,
  },

  planOwnerLine: {
    color: MUTED3,
    marginTop: 5,
    fontSize: TYPE_MICRO,
    fontFamily: fonts.medium,
    letterSpacing: 0.1,
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
