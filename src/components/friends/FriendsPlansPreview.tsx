import {
  listSectionTitle,
  sectionLinkText,
  SPACE_4,
} from "@/constants/Variables";
import FriendPlanCard from "@/src/components/friends/FriendPlanCard";
import type { FriendOpenPlanEvent } from "@/src/lib/friendOpenPlanJoin";
import type { AggregatedFriendPlan } from "@/src/lib/useFriendPlansFeed";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

const PLAN_PREVIEW_COUNT = 2;

type FeedSlice = {
  aggregatedPlans: AggregatedFriendPlan[];
  hostDisplayNameByUid: Record<string, string>;
  viewerEvents?: FriendOpenPlanEvent[];
  friendImageByUid?: Record<string, string | null>;
  planJoined: (item: AggregatedFriendPlan) => boolean;
  planIsHost: (item: AggregatedFriendPlan) => boolean;
  handlePlanAction: (item: AggregatedFriendPlan) => void;
  isPlanBusy: (item: AggregatedFriendPlan) => boolean;
};

type Props = FeedSlice & {
  userId: string;
  onSeeAll: () => void;
  onOpenFriendProfile: (friendId: string) => void;
};

export default function FriendsPlansPreview({
  userId,
  aggregatedPlans,
  hostDisplayNameByUid,
  viewerEvents,
  friendImageByUid,
  planJoined,
  planIsHost,
  handlePlanAction,
  isPlanBusy,
  onSeeAll,
  onOpenFriendProfile,
}: Props) {
  if (aggregatedPlans.length === 0) return null;

  const previewPlans = aggregatedPlans.slice(0, PLAN_PREVIEW_COUNT);
  const hasMore = aggregatedPlans.length > PLAN_PREVIEW_COUNT;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>Upcoming</Text>
        {hasMore ? (
          <TouchableOpacity
            onPress={onSeeAll}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={`See all ${aggregatedPlans.length} plans`}
          >
            <Text style={styles.sectionLink}>See all</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {previewPlans.map((item) => (
        <FriendPlanCard
          key={`${item.sourceFriendId}|${item.event.id}`}
          item={item}
          viewerId={userId}
          hostDisplayNameByUid={hostDisplayNameByUid}
          viewerEvents={viewerEvents}
          friendImageByUid={friendImageByUid}
          joined={planJoined(item)}
          isHost={planIsHost(item)}
          busy={isPlanBusy(item)}
          onPressCard={() => onOpenFriendProfile(item.sourceFriendId)}
          onPressAction={() => void handlePlanAction(item)}
          onOpenPersonProfile={onOpenFriendProfile}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 8,
    paddingHorizontal: 20,
    paddingTop: SPACE_4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sectionTitle: {
    ...listSectionTitle,
  },
  sectionLink: {
    ...sectionLinkText,
  },
});
