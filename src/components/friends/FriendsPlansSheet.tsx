import {
  BG,
  BORDER,
  MUTED2,
  TEXT,
  TYPE_LEAD,
  TYPE_SECTION,
  fonts,
  listRowTitleText,
  sheetHeaderTitleText,
} from "@/constants/Variables";
import CloseButton from "@/src/components/CloseButton";
import FriendPlanCard from "@/src/components/friends/FriendPlanCard";
import type { useFriendPlansFeed } from "@/src/lib/useFriendPlansFeed";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
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
  const {
    aggregatedPlans,
    hostDisplayNameByUid,
    viewerEvents,
    friendImageByUid,
    planJoined,
    planIsHost,
    handlePlanAction,
    isPlanBusy,
  } = feed;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(24, insets.bottom) }]}>
          <View style={styles.header}>
            <Text style={styles.title}>Upcoming</Text>
            <CloseButton onPress={onClose} accessibilityLabel="Close plans" />
          </View>

          <FlatList
            data={aggregatedPlans}
            keyExtractor={(item) => `${item.sourceFriendId}|${item.event.id}`}
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
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    maxHeight: "88%",
    backgroundColor: BG,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: BORDER,
    borderBottomWidth: 0,
    paddingTop: 16,
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
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  emptyWrap: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 16,
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
