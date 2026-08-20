import AlertModal from "@/app/alert-modal";
import CheckmarkToast from "@/src/components/CheckmarkToast";
import ConfirmModal from "@/app/confirm-modal";
import {
  MUTED2,
  TAB_BAR_SCROLL_INSET,
  TYPE_LEAD,
  fonts,
  listRowTitleText,
  listSectionTitle,
} from "@/constants/Variables";
import FriendPlanCard from "@/src/components/friends/FriendPlanCard";
import { PlanCardsSkeleton } from "@/src/components/loading/BrandSkeletons";
import type { AggregatedFriendPlan, useFriendPlansFeed } from "@/src/lib/useFriendPlansFeed";
import { forwardRef, useImperativeHandle, useRef } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";

type Feed = ReturnType<typeof useFriendPlansFeed>;

type Props = {
  userId: string;
  feed: Feed;
  onOpenFriendProfile: (
    friendId: string,
    preview?: { displayName?: string; imageUrl?: string | null }
  ) => void;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
};

export type FriendsPlansPaneHandle = {
  scrollToTop: (animated?: boolean) => void;
};

function FriendsPlansEmpty({ hasFriends }: { hasFriends: boolean }) {
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyTitle}>
        {hasFriends ? "Nothing planned right now" : "No friend plans yet"}
      </Text>
      <Text style={styles.emptyText}>
        {hasFriends
          ? "When friends add plans, they'll show up here."
          : "Add friends to see what they have coming up."}
      </Text>
    </View>
  );
}

const FriendsPlansPane = forwardRef<FriendsPlansPaneHandle, Props>(function FriendsPlansPane(
  { userId, feed, onOpenFriendProfile, onScroll },
  ref
) {
  const listRef = useRef<FlatList<AggregatedFriendPlan>>(null);
  const {
    aggregatedPlans,
    eventsHydrated,
    visibleFriends,
    hostDisplayNameByUid,
    viewerEvents,
    friendImageByUid,
    planJoined,
    planIsHost,
    handlePlanAction,
    isPlanBusy,
    pendingJoin,
    confirmJoin,
    cancelJoin,
    pendingUnjoin,
    confirmUnjoin,
    cancelUnjoin,
    successToast,
    dismissSuccessToast,
    errorAlertVisible,
    errorAlertMessage,
    dismissErrorAlert,
  } = feed;

  useImperativeHandle(ref, () => ({
    scrollToTop(animated = false) {
      listRef.current?.scrollToOffset({ offset: 0, animated });
    },
  }));

  if (!eventsHydrated && visibleFriends.length > 0) {
    return (
      <View style={styles.loadingWrap}>
        <PlanCardsSkeleton />
      </View>
    );
  }

  return (
    <>
      <FlatList
        ref={listRef}
        style={styles.list}
        contentContainerStyle={[
          styles.listContent,
          aggregatedPlans.length === 0 && styles.listContentEmpty,
          { paddingBottom: TAB_BAR_SCROLL_INSET + 40 },
        ]}
        data={aggregatedPlans}
        keyExtractor={(item) => `${item.sourceFriendId}|${item.event.id}`}
        renderItem={({ item }) => (
          <FriendPlanCard
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
            cardPressOpensGoing
          />
        )}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          aggregatedPlans.length > 0 ? (
            <Text style={styles.sectionTitle}>Upcoming</Text>
          ) : null
        }
        ListEmptyComponent={<FriendsPlansEmpty hasFriends={visibleFriends.length > 0} />}
      />

      <ConfirmModal
        visible={pendingJoin != null}
        title="Join this plan?"
        message=""
        confirmText="Join"
        onCancel={cancelJoin}
        onConfirm={() => {
          void confirmJoin();
        }}
      />
      <ConfirmModal
        visible={pendingUnjoin != null}
        title="Remove this plan?"
        message=""
        confirmText="Remove"
        destructive
        onCancel={cancelUnjoin}
        onConfirm={() => {
          void confirmUnjoin();
        }}
      />
      <CheckmarkToast
        visible={!!successToast}
        message={successToast ?? ""}
        onDismiss={dismissSuccessToast}
      />
      <AlertModal
        visible={errorAlertVisible}
        title="Error"
        message={errorAlertMessage}
        onClose={dismissErrorAlert}
      />
    </>
  );
});

export default FriendsPlansPane;

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: "center",
  },
  loadingWrap: {
    flex: 1,
    paddingTop: 48,
  },
  sectionTitle: {
    ...listSectionTitle,
    marginBottom: 14,
  },
  emptyWrap: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  emptyTitle: {
    ...listRowTitleText,
    fontFamily: fonts.heavy,
    textAlign: "center",
  },
  emptyText: {
    color: MUTED2,
    fontSize: TYPE_LEAD,
    fontFamily: fonts.book,
    textAlign: "center",
    marginTop: 10,
    lineHeight: 22,
  },
});
