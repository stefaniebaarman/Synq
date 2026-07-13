import {
  BG,
  BORDER,
  MUTED2,
  RADIUS_2XL,
  TEXT,
  TYPE_LEAD,
  TYPE_SECTION,
  fonts,
  listRowTitleText,
  sheetHeaderTitleText,
} from "@/constants/Variables";
import ConfirmModal from "@/app/confirm-modal";
import CloseButton from "@/src/components/CloseButton";
import FriendPlanCard from "@/src/components/friends/FriendPlanCard";
import SpringBottomSheet from "@/src/components/sheets/SpringBottomSheet";
import type { useFriendPlansFeed } from "@/src/lib/useFriendPlansFeed";
import {
  FlatList,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Feed = ReturnType<typeof useFriendPlansFeed>;

type Props = {
  visible: boolean;
  userId: string;
  feed: Feed;
  onClose: () => void;
  onOpenFriendProfile: (friendId: string) => void;
};

export default function FriendsPlansSheet({
  visible,
  userId,
  feed,
  onClose,
  onOpenFriendProfile,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const sheetHeight = Math.round(windowHeight * 0.88);
  const {
    aggregatedPlans,
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
  } = feed;

  const confirmOverlay = (
    <>
      <ConfirmModal
        embedded
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
        embedded
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
    </>
  );

  return (
    <SpringBottomSheet
      visible={visible}
      onClose={onClose}
      cardStyle={[
        styles.sheet,
        { height: sheetHeight, paddingBottom: Math.max(24, insets.bottom) },
      ]}
      overlay={confirmOverlay}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Upcoming</Text>
        <CloseButton onPress={onClose} accessibilityLabel="Close plans" />
      </View>

      <FlatList
        data={aggregatedPlans}
        keyExtractor={(item) => `${item.sourceFriendId}|${item.event.id}`}
        style={styles.list}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          aggregatedPlans.length === 0 && styles.listContentEmpty,
        ]}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>Nothing planned right now</Text>
            <Text style={styles.emptyText}>
              When friends add plans, they'll show up here.
            </Text>
          </View>
        }
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
          />
        )}
      />
    </SpringBottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: BG,
    borderRadius: RADIUS_2XL,
    borderWidth: 1,
    borderColor: BORDER,
    paddingTop: 8,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  title: {
    ...sheetHeaderTitleText,
    color: TEXT,
    fontSize: TYPE_SECTION,
    lineHeight: 26,
    letterSpacing: 0.04,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: "center",
  },
  emptyWrap: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyTitle: {
    ...listRowTitleText,
    textAlign: "center",
  },
  emptyText: {
    color: MUTED2,
    fontFamily: fonts.book,
    fontSize: TYPE_LEAD,
    textAlign: "center",
    lineHeight: 20,
  },
});
