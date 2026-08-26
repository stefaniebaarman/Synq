import {
  BG,
  BORDER,
  FRIENDS_SEARCH_BORDER,
  MUTED2,
  MUTED3,
  RADIUS_2XL,
  RADIUS_MD,
  SURFACE_INPUT,
  TEXT,
  TYPE_LEAD,
  fonts,
  formInputText,
  emptyStateTitleText,
  sheetTitleText,
} from "@/constants/Variables";
import ConfirmModal from "@/app/confirm-modal";
import CloseButton from "@/src/components/CloseButton";
import CloseIcon from "@/src/components/CloseIcon";
import FriendPlanCard from "@/src/components/friends/FriendPlanCard";
import SpringBottomSheet from "@/src/components/sheets/SpringBottomSheet";
import type { AggregatedFriendPlan, useFriendPlansFeed } from "@/src/lib/useFriendPlansFeed";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
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
  onOpenFriendProfile: (
    friendId: string,
    preview?: { displayName?: string; imageUrl?: string | null }
  ) => void;
};

function planSearchHaystack(
  item: AggregatedFriendPlan,
  hostDisplayNameByUid: Record<string, string>
): string {
  const event = item.event;
  const parts: string[] = [
    item.sourceFriendName,
    hostDisplayNameByUid[item.sourceFriendId] || "",
    String(event.title || ""),
    String(event.location || ""),
    String(event.time || ""),
  ];

  if (Array.isArray(event.joinedFromNames)) {
    for (const name of event.joinedFromNames) {
      if (name) parts.push(String(name));
    }
  }

  if (Array.isArray(event.joinedFromIds)) {
    for (const id of event.joinedFromIds) {
      const uid = String(id || "").trim();
      if (uid && hostDisplayNameByUid[uid]) parts.push(hostDisplayNameByUid[uid]);
    }
  }

  const attendeeNames = event.attendeeDisplayNames;
  if (attendeeNames && typeof attendeeNames === "object") {
    parts.push(...Object.values(attendeeNames).filter(Boolean));
  }

  return parts.join(" ").toLowerCase();
}

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
  const [searchText, setSearchText] = useState("");
  const {
    aggregatedPlans,
    hostDisplayNameByUid,
    visibleFriends,
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

  const friendIds = useMemo(
    () => visibleFriends.map((friend) => friend.id).filter(Boolean),
    [visibleFriends]
  );

  useEffect(() => {
    if (!visible) setSearchText("");
  }, [visible]);

  const query = searchText.trim().toLowerCase();
  const filteredPlans = useMemo(() => {
    if (!query) return aggregatedPlans;
    return aggregatedPlans.filter((item) =>
      planSearchHaystack(item, hostDisplayNameByUid).includes(query)
    );
  }, [aggregatedPlans, hostDisplayNameByUid, query]);

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

  const emptyTitle = query
    ? "No matching plans"
    : "Nothing planned right now";
  const emptyText = query
    ? "Try another name, venue, or plan title."
    : "When friends add plans, they'll show up here.";

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

      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={17} color={MUTED2} />
          <TextInput
            placeholder="Search by name, venue…"
            placeholderTextColor={MUTED3}
            style={styles.searchBarInput}
            value={searchText}
            onChangeText={setSearchText}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="never"
          />
          {searchText.length > 0 ? (
            <TouchableOpacity
              onPress={() => setSearchText("")}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <CloseIcon variant="inline" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <FlatList
        data={filteredPlans}
        keyExtractor={(item) => `${item.sourceFriendId}|${item.event.id}`}
        style={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          filteredPlans.length === 0 && styles.listContentEmpty,
        ]}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>{emptyTitle}</Text>
            <Text style={styles.emptyText}>{emptyText}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <FriendPlanCard
            item={item}
            viewerId={userId}
            hostDisplayNameByUid={hostDisplayNameByUid}
            viewerEvents={viewerEvents}
            friendImageByUid={friendImageByUid}
            friendIds={friendIds}
            joined={planJoined(item)}
            isHost={planIsHost(item)}
            busy={isPlanBusy(item)}
            cardPressOpensGoing
            onPressCard={() => {}}
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
    ...sheetTitleText,
  },
  searchWrap: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: RADIUS_MD,
    backgroundColor: SURFACE_INPUT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: FRIENDS_SEARCH_BORDER,
    gap: 10,
  },
  searchBarInput: {
    ...formInputText,
    flex: 1,
    paddingVertical: 0,
    minHeight: 22,
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
    ...emptyStateTitleText,
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
