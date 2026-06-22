import {
  ACCENT,
  ACCENT_BORDER,
  ACCENT_ICON,
  BG,
  BG_FADE_HEAVY,
  BG_TRANSPARENT,
  BORDER,
  BUTTON_RADIUS,
  DESTRUCTIVE,
  FRIENDS_BORDER,
  FRIENDS_SEARCH_BORDER,
  Friend,
  MUTED,
  MUTED2,
  MUTED3,
  OVERLAY_HEAVY,
  OVERLAY_PANEL,
  RADIUS_MD,
  SHADOW,
  SPACE_3,
  SPACE_4,
  SPACE_5,
  SPACE_6,
  SURFACE,
  SURFACE_INPUT,
  SURFACE_MUTED,
  SURFACE_RAISED,
  TAB_BAR_SCROLL_INSET,
  TEXT,
  TYPE_BODY,
  TYPE_BUTTON,
  TYPE_CAPTION,
  TYPE_CTA,
  TYPE_DISPLAY,
  TYPE_LEAD,
  cardMetaText,
  fonts,
  listRowTitleText,
  profileNameText,
  profileScreenSectionTitle,
  stackScreenHeaderTitle,
  synqOutlineAddBtn,
  synqOutlineAddBtnCompact,
  synqOutlineAddBtnDisabled,
  synqOutlineAddBtnText,
  synqOutlineAddBtnTextCompact,
  synqOutlineAddBtnTextDisabled,
  tabScreenMainHeaderTitle,
} from "@/constants/Variables";
import CloseButton from "@/src/components/CloseButton";
import CloseIcon from "@/src/components/CloseIcon";
import FriendsGroupsHeaderTitle, {
  type FriendsTabMode,
} from "@/src/components/friends/FriendsGroupsSegment";
import FriendsPlansPreview from "@/src/components/friends/FriendsPlansPreview";
import FriendsPlansSheet from "@/src/components/friends/FriendsPlansSheet";
import {
  FriendsSortMenu,
  FriendsSortTrigger,
  type FriendsSortMode,
} from "@/src/components/friends/FriendsSortControls";
import GroupsListPane from "@/src/components/friends/GroupsListPane";
import ProfileQrScannerModal from "@/src/components/friends/ProfileQrScannerModal";
import ProfileTabHeaderOverlay, {
  useTabHeaderLayout,
} from "@/src/components/ProfileTabHeaderOverlay";
import SynqPlusAddButton from "@/src/components/SynqPlusAddButton";
import TabHeaderIconRow from "@/src/components/TabHeaderIconRow";
import { useBlockedUsers } from "@/src/lib/blockedUsers";
import { ignoreSnapshotPermissionDenied } from "@/src/lib/firestoreListeners";
import { createFriendGroup } from "@/src/lib/friendGroups";
import { friendLocationLine, resolveAvatar } from "@/src/lib/helpers";
import { useFriendPlansFeed } from "@/src/lib/useFriendPlansFeed";
import {
  fetchSuggestedFriends,
  searchUsersForFriend,
} from "@/src/lib/userSearch";
import { useSortedFriendsList } from "@/src/lib/useSortedFriendsList";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch
} from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  DeviceEventEmitter,
  Dimensions,
  FlatList,
  Keyboard,
  Platform,
  SectionList,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewStyle
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, db } from "../../src/lib/firebase";
import { FRIENDS_TAB_PRESS } from "../../src/lib/friendsTabEvents";
import { LOCATION_PROMPT_CHECK_REQUEST } from "../../src/lib/locationPromptEvents";
import { registerDismissNavigationOverlaysHandler } from "../../src/lib/navigationOverlayEvents";
import {
  friendIdsKey,
  friendProfileCacheByUser,
  friendsListCacheByUser,
  hydrateMutualCountsForUsers,
  resolveMutualFriendCount,
  setCachedOutgoingFriendRequest,
  suggestedCacheByUser,
  syncOutgoingFriendRequestsCache,
  warmFriendsAndConnectionsCache,
  warmOutgoingFriendRequestsCache,
  warmSuggestedCache,
} from "../../src/lib/socialCache";
import { useAuthRefresh } from "../_layout";
import AlertModal from "../alert-modal";
import ConfirmModal from "../confirm-modal";

const { width } = Dimensions.get("window");

const sortFriendsByName = (list: Friend[]) =>
  [...list].sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));

function formatMyCityLabel(city: string, state: string): string {
  if (!city.trim()) return "";
  const c = city.trim();
  const s = state.trim();
  return s ? `${c}, ${s}` : c;
}

function splitDisplayName(displayName?: string | null) {
  const raw = (displayName || "").trim();
  if (!raw) return { first: "User", last: "" };
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

const STAGGER_DELAYS = [0, 120] as const;

function emptyEntering(reduced: boolean, delayMs: number) {
  if (reduced) {
    return FadeIn.duration(1);
  }
  return FadeInDown.duration(380).delay(delayMs);
}

function FriendsHeaderAddButton({
  pulse,
  onPress,
}: {
  pulse: boolean;
  onPress: () => void;
}) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (reduced || !pulse) {
      cancelAnimation(scale);
      scale.value = 1;
      return;
    }
    scale.value = withRepeat(
      withSequence(
        withTiming(1.07, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
    return () => {
      cancelAnimation(scale);
    };
  }, [pulse, reduced, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <TouchableOpacity
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      accessibilityLabel="Add friends"
      activeOpacity={0.75}
    >
      <Animated.View style={[animatedStyle, styles.headerAddBtn]}>
        <Ionicons name="person-add-outline" size={22} color={ACCENT_ICON} />
      </Animated.View>
    </TouchableOpacity>
  );
}

function FriendsEmptyMainContent({
  onAddFriends,
}: {
  onAddFriends: () => void;
}) {
  const reduced = useReducedMotion();

  const onPressAdd = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onAddFriends();
  };

  return (
    <View style={styles.emptyStateMain}>
      <Animated.View
        entering={emptyEntering(reduced, STAGGER_DELAYS[0])}
        style={styles.emptyHeroBlock}
      >
        <Text style={styles.emptyHeroTitle}>
          <Text style={styles.emptyHeroAccent}>Your friends.</Text>
          {"\n"}Your plans.
        </Text>
        <Text style={styles.emptyHeroSubtitle}>
          {`Build your circle — then see who's free.`}
        </Text>
      </Animated.View>

      <Animated.View
        entering={emptyEntering(reduced, STAGGER_DELAYS[1])}
        style={styles.emptyPrimaryCtaWrap}
      >
        <TouchableOpacity
          style={[synqOutlineAddBtn, styles.emptyPrimaryCta]}
          onPress={onPressAdd}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Add friends"
        >
          <Ionicons name="person-add-outline" size={20} color={ACCENT} />
          <Text style={synqOutlineAddBtnText}>Add friends</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

function FriendsListEmpty({
  hasFriends,
  searchText,
  onAddFriends,
  onClearSearch,
}: {
  hasFriends: boolean;
  searchText: string;
  onAddFriends: () => void;
  onClearSearch: () => void;
}) {
  const reduced = useReducedMotion();
  if (hasFriends && searchText.trim().length > 0) {
    return (
      <Animated.View
        entering={reduced ? FadeIn.duration(1) : FadeInDown.duration(400)}
        style={styles.emptyStateCenter}
      >
        <Ionicons name="search-outline" size={40} color={MUTED2} />
        <Text style={styles.emptyTitle}>No matches</Text>
        <Text style={styles.emptyText}>
          {`No friend named "${searchText.trim()}". Try another spelling or clear search.`}
        </Text>
        <TouchableOpacity onPress={onClearSearch} style={styles.emptySecondaryBtn} activeOpacity={0.8}>
          <Text style={styles.emptySecondaryBtnText}>Clear search</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return <FriendsEmptyMainContent onAddFriends={onAddFriends} />;
}

export default function FriendsScreen() {
  const router = useRouter();
  const { user } = useAuthRefresh();
  const headerLayout = useTabHeaderLayout();
  const isFriendsTabFocused = useIsFocused();
  const { openAddFriends } = useLocalSearchParams<{ openAddFriends?: string }>();
  const myId = user?.uid ?? "";
  const cachedFriends = myId ? friendsListCacheByUser[myId] ?? [] : [];
  const [friends, setFriends] = useState<Friend[]>(cachedFriends);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [isFriendsInitialLoading, setIsFriendsInitialLoading] = useState(cachedFriends.length === 0);
  const [friendsLoadError, setFriendsLoadError] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [sortMode, setSortMode] = useState<FriendsSortMode>("alphabetical");
  const [sortMenuVisible, setSortMenuVisible] = useState(false);
  const [myCoords, setMyCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [myCityLabel, setMyCityLabel] = useState("");
  const [headerFadeTop, setHeaderFadeTop] = useState(0);
  const [listScrollY, setListScrollY] = useState(0);
  const [friendsTabMode, setFriendsTabMode] = useState<FriendsTabMode>("friends");
  const [plansSheetVisible, setPlansSheetVisible] = useState(false);
  const friendsListRef = useRef<FlatList<Friend>>(null);
  const friendsRefreshInFlightRef = useRef(false);
  const lastFriendsIdsKeyRef = useRef("");

  const showAddFriendsModal = searchModalVisible;
  const headerFadeOpacity = Math.min(1, listScrollY / 28);

  const onFriendsHeaderLayout = useCallback((e: LayoutChangeEvent) => {
    const { y, height } = e.nativeEvent.layout;
    setHeaderFadeTop(y + height);
  }, []);

  const onFriendsListScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setListScrollY(e.nativeEvent.contentOffset.y);
  }, []);

  const closeAddFriendsModal = useCallback(() => {
    setSearchModalVisible(false);
  }, []);

  const closePlansSheet = useCallback(() => {
    setPlansSheetVisible(false);
  }, []);

  const scrollFriendsListToTop = useCallback((animated = false) => {
    friendsListRef.current?.scrollToOffset({ offset: 0, animated });
    setListScrollY(0);
  }, []);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(FRIENDS_TAB_PRESS, () => {
      scrollFriendsListToTop(true);
      closeAddFriendsModal();
      closePlansSheet();
      if (openAddFriends === "1") {
        router.setParams({ openAddFriends: "" });
      }
    });
    return () => subscription.remove();
  }, [scrollFriendsListToTop, closeAddFriendsModal, closePlansSheet, openAddFriends, router]);

  useEffect(() => {
    return registerDismissNavigationOverlaysHandler(() => {
      closeAddFriendsModal();
      closePlansSheet();
    });
  }, [closeAddFriendsModal, closePlansSheet]);

  useEffect(() => {
    if (openAddFriends !== "1") return;
    setSearchModalVisible(true);
  }, [openAddFriends]);

  const openFriendProfileFromAddFriends = useCallback(
    (friendId: string) => {
      Keyboard.dismiss();
      router.push({
        pathname: "/friend-profile",
        params: { friendId, from: "add-friends" },
      });
    },
    [router]
  );

  const openAddFriendsModal = useCallback(() => {
    setSearchModalVisible(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      scrollFriendsListToTop(false);

      const t = setTimeout(() => {
        DeviceEventEmitter.emit(LOCATION_PROMPT_CHECK_REQUEST);
      }, 1000);
      return () => clearTimeout(t);
    }, [scrollFriendsListToTop])
  );

  useEffect(() => {
    if (!myId) return;
    let cancelled = false;
    getDoc(doc(db, "users", myId))
      .then((snap) => {
        if (cancelled || !snap.exists()) return;
        const data = snap.data() as {
          lat?: unknown;
          lng?: unknown;
          city?: unknown;
          state?: unknown;
          locationDisplay?: unknown;
        };
        const lat = typeof data.lat === "number" ? data.lat : null;
        const lng = typeof data.lng === "number" ? data.lng : null;
        if (lat != null && lng != null) {
          setMyCoords({ lat, lng });
        }
        const city = typeof data.city === "string" ? data.city : "";
        const state = typeof data.state === "string" ? data.state : "";
        const label =
          typeof data.locationDisplay === "string" && data.locationDisplay.trim()
            ? data.locationDisplay.trim()
            : formatMyCityLabel(city, state);
        if (label) setMyCityLabel(label);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [myId]);

  useEffect(() => {
    if (!myId) return;

    if (!friendProfileCacheByUser[myId]) {
      friendProfileCacheByUser[myId] = {};
    }
    const friendsRef = collection(db, "users", myId, "friends");

    let cancelled = false;
    const unsubFriends = onSnapshot(
      friendsRef,
      async (snapshot) => {
      if (cancelled) return;
      const friendIds = snapshot.docs.map((d) => d.id);
      const profileCache = friendProfileCacheByUser[myId];

      try {
        const cachedVisible = sortFriendsByName(
          friendIds
            .map((id) => profileCache[id])
            .filter(Boolean) as Friend[]
        );

        if (cachedVisible.length > 0) {
          setFriends(cachedVisible);
          setIsFriendsInitialLoading(false);
        } else {
          setIsFriendsInitialLoading(true);
        }
        void warmOutgoingFriendRequestsCache(myId);
        const idsKey = friendIdsKey(friendIds);
        const friendsChanged = idsKey !== lastFriendsIdsKeyRef.current;
        lastFriendsIdsKeyRef.current = idsKey;
        await warmFriendsAndConnectionsCache(myId, {
          friendIds,
          force: friendsChanged,
        });
        const fetchedFriends: Friend[] = friendIds.map(
          (friendId) =>
            profileCache[friendId] ??
            ({
              id: friendId,
              displayName: "Unknown",
              mutualCount: 0,
            } as Friend)
        );

        const sortedFriends = sortFriendsByName(fetchedFriends);
        if (cancelled) return;
        sortedFriends.forEach((friend) => {
          profileCache[friend.id] = friend;
        });

        friendsListCacheByUser[myId] = sortedFriends;
        if (cancelled) return;
        setFriends(sortedFriends);
        setFriendsLoadError(false);
      } catch (err) {
        console.error("[FriendsScreen] Error fetching friend data:", err);
        setFriendsLoadError(true);
      } finally {
        setIsFriendsInitialLoading(false);
      }
    },
      ignoreSnapshotPermissionDenied
    );

    return () => {
      cancelled = true;
      unsubFriends();
    };
  }, [myId]);

  const refreshFriends = useCallback(async () => {
    if (!myId || friendsRefreshInFlightRef.current) return;
    friendsRefreshInFlightRef.current = true;
    setFriendsLoadError(false);
    try {
      await warmFriendsAndConnectionsCache(myId, { force: true });
      const nextFriends = sortFriendsByName(friendsListCacheByUser[myId] ?? []);
      setFriends(nextFriends);
    } catch {
      setFriendsLoadError(true);
    } finally {
      friendsRefreshInFlightRef.current = false;
    }
  }, [myId]);

  const { isBlocked } = useBlockedUsers();

  const openFriendProfileFromFriendsTab = useCallback(
    (friendId: string) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push({
        pathname: "/friend-profile",
        params: { friendId, from: "friends" },
      });
    },
    [router]
  );

  const friendPlansFeed = useFriendPlansFeed({
    userId: myId,
    friends,
    isBlocked,
  });

  const showFriendsPlansPreview =
    friendsTabMode === "friends" &&
    !isFriendsInitialLoading &&
    friendPlansFeed.aggregatedPlans.length > 0;

  const friendsListHeader = useMemo(() => {
    if (!showFriendsPlansPreview) return null;
    return (
      <FriendsPlansPreview
        userId={myId}
        aggregatedPlans={friendPlansFeed.aggregatedPlans}
        hostDisplayNameByUid={friendPlansFeed.hostDisplayNameByUid}
        viewerEvents={friendPlansFeed.viewerEvents}
        friendImageByUid={friendPlansFeed.friendImageByUid}
        planJoined={friendPlansFeed.planJoined}
        planIsHost={friendPlansFeed.planIsHost}
        handlePlanAction={friendPlansFeed.handlePlanAction}
        isPlanBusy={friendPlansFeed.isPlanBusy}
        onSeeAll={() => setPlansSheetVisible(true)}
        onOpenFriendProfile={openFriendProfileFromFriendsTab}
      />
    );
  }, [
    showFriendsPlansPreview,
    myId,
    friendPlansFeed.aggregatedPlans,
    friendPlansFeed.hostDisplayNameByUid,
    friendPlansFeed.viewerEvents,
    friendPlansFeed.friendImageByUid,
    friendPlansFeed.planJoined,
    friendPlansFeed.planIsHost,
    friendPlansFeed.handlePlanAction,
    friendPlansFeed.isPlanBusy,
    openFriendProfileFromFriendsTab,
  ]);

  const userProfileForSort = useMemo(
    () =>
      ({
        ...(myCoords ? { lat: myCoords.lat, lng: myCoords.lng } : {}),
        ...(myCityLabel ? { locationDisplay: myCityLabel } : {}),
      }) as Record<string, unknown>,
    [myCoords, myCityLabel]
  );

  const filteredFriends = useMemo(
    () =>
      friends.filter((f) => {
        if (isBlocked(f.id)) return false;
        return (f.displayName || "")
          .toLowerCase()
          .includes(searchText.toLowerCase());
      }),
    [friends, searchText, isBlocked]
  );

  const displayFriends = useSortedFriendsList(filteredFriends, sortMode, userProfileForSort);

  const showFriendSearch =
    friendsTabMode === "friends" && friends.length > 0 && !isFriendsInitialLoading;
  const listIsEmpty = displayFriends.length === 0;

  const handleCreateGroup = useCallback(
    async (name: string, memberIds: string[] = []) => {
      if (!myId) throw new Error("Not signed in.");
      return createFriendGroup(myId, name, memberIds);
    },
    [myId]
  );

  const renderFriendRowSeparator = () => <View style={styles.friendRowSeparator} />;

  const renderSkeletonRow = (key: string) => (
    <View key={key} style={styles.friendRow}>
      <View style={[styles.avatarRing, styles.skeletonBlock]} />
      <View style={{ flex: 1 }}>
        <View style={[styles.skeletonBlock, { height: 14, width: "55%", marginBottom: 8 }]} />
        <View style={[styles.skeletonBlock, { height: 12, width: "38%" }]} />
      </View>
    </View>
  );

  const renderFriendRow = ({ item }: { item: Friend }) => {
    const locationLine = friendLocationLine(item);
    const fallbackLoc =
      typeof (item as any)?.location === "string" && (item as any).location.trim()
        ? (item as any).location
        : "";
    const locationText = locationLine || fallbackLoc || "";
    const nameParts = splitDisplayName(item.displayName);

    return (
    <TouchableOpacity
      style={styles.friendRow}
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.displayName || "friend"} profile`}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({
          pathname: "/friend-profile",
          params: { friendId: item.id, from: "friends" },
        });
      }}
    >
      <View style={styles.avatarRing}>
        <ExpoImage
          source={{ uri: resolveAvatar((item as any)?.imageurl) }}
          style={styles.img}
          cachePolicy="memory-disk"
          transition={120}
        />
      </View>

      <View style={styles.friendRowContent}>
        <Text style={styles.friendRowName} numberOfLines={1}>
          <Text style={styles.friendNameAccent}>{nameParts.first}</Text>
          {nameParts.last.length > 0 ? (
            <Text style={styles.friendNameAccent}> {nameParts.last}</Text>
          ) : null}
        </Text>
        {locationText.length > 0 && (
          <View style={styles.friendRowMeta}>
            <Ionicons
              name="location-outline"
              size={12}
              color={MUTED2}
              style={styles.friendRowMetaIcon}
            />
            <Text style={styles.friendRowLocation} numberOfLines={1}>
              {locationText}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
    );
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.screenRoot}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />

      <ProfileTabHeaderOverlay variant="title" />
      <TabHeaderIconRow>
        <FriendsGroupsHeaderTitle mode={friendsTabMode} onChange={setFriendsTabMode} />
        {friendsTabMode === "friends" ? (
          <FriendsHeaderAddButton
            pulse={!isFriendsInitialLoading && friends.length === 0}
            onPress={openAddFriendsModal}
          />
        ) : null}
      </TabHeaderIconRow>

      <View onLayout={onFriendsHeaderLayout}>
        <View
          style={[
            styles.headerBlock,
            styles.screenPadding,
            { paddingTop: headerLayout.iconRowBottom + 14 },
          ]}
        >
          {showFriendSearch && (
            <>
              <View style={styles.searchBar}>
                <Ionicons name="search-outline" size={17} color={MUTED2} />
                <TextInput
                  placeholder="Search"
                  placeholderTextColor={MUTED3}
                  style={styles.searchBarInput}
                  value={searchText}
                  onChangeText={setSearchText}
                />
                {searchText.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchText("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <CloseIcon variant="inline" />
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.sortBar}>
                <FriendsSortTrigger
                  sortMode={sortMode}
                  onPress={() => setSortMenuVisible(true)}
                />
              </View>
            </>
          )}
        </View>
      </View>

      {friendsLoadError && !isFriendsInitialLoading ? (
        <View style={styles.friendsLoadErrorWrap}>
          <Text style={styles.friendsLoadErrorText}>
            Could not load friends.
          </Text>
          <TouchableOpacity
            onPress={() => void refreshFriends()}
            accessibilityRole="button"
            accessibilityLabel="Retry loading friends"
          >
            <Text style={styles.friendsLoadErrorRetry}>Tap to retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {friendsTabMode === "groups" ? (
        <View style={[styles.friendsList, styles.screenPadding]}>
          <GroupsListPane
            userId={myId}
            friends={friends}
            listBottomInset={TAB_BAR_SCROLL_INSET + 40}
            onCreateGroup={handleCreateGroup}
          />
        </View>
      ) : isFriendsInitialLoading ? (
        <View style={styles.friendsList}>
          {["1", "2", "3"].map((k, i) => (
            <View key={k}>
              {i > 0 ? renderFriendRowSeparator() : null}
              {renderSkeletonRow(k)}
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          ref={friendsListRef}
          style={styles.friendsList}
          scrollIndicatorInsets={{ right: 0 }}
          data={displayFriends}
          keyExtractor={(item) => item.id}
          renderItem={renderFriendRow}
          ItemSeparatorComponent={renderFriendRowSeparator}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScroll={onFriendsListScroll}
          scrollEventThrottle={16}
          onScrollBeginDrag={Keyboard.dismiss}
          ListHeaderComponent={friendsListHeader}
          ListFooterComponent={<View style={{ height: 40 }} />}
          contentContainerStyle={listIsEmpty ? styles.friendsListContentEmpty : styles.friendsListContent}
          ListEmptyComponent={
            <FriendsListEmpty
              hasFriends={friends.length > 0}
              searchText={searchText}
              onAddFriends={openAddFriendsModal}
              onClearSearch={() => setSearchText("")}
            />
          }
        />
      )}
        <FriendsSortMenu
          visible={sortMenuVisible}
          sortMode={sortMode}
          onSelect={setSortMode}
          onClose={() => setSortMenuVisible(false)}
        />
        {showFriendSearch && headerFadeTop > 0 && headerFadeOpacity > 0 ? (
          <LinearGradient
            pointerEvents="none"
            colors={FRIENDS_SEARCH_FADE_GRADIENT}
            locations={[0, 0.42, 1]}
            style={[
              styles.headerScrollFade,
              { top: headerFadeTop - 4, opacity: headerFadeOpacity },
            ]}
          />
        ) : null}
      </View>
        <SearchModal
          visible={showAddFriendsModal}
          hardwareBackEnabled={isFriendsTabFocused}
          onClose={closeAddFriendsModal}
          onOpenProfile={openFriendProfileFromAddFriends}
          currentFriends={friends.map((f) => f.id)}
        />
        <FriendsPlansSheet
          visible={plansSheetVisible}
          userId={myId}
          feed={friendPlansFeed}
          onClose={closePlansSheet}
          onOpenFriendProfile={openFriendProfileFromFriendsTab}
        />
        <ConfirmModal
          visible={friendPlansFeed.pendingUnjoin != null}
          title="Remove this plan?"
          message="This removes it from your plans and updates this for your friend."
          confirmText="Remove"
          destructive
          onCancel={friendPlansFeed.cancelUnjoin}
          onConfirm={() => {
            void friendPlansFeed.confirmUnjoin();
          }}
        />
        <AlertModal
          visible={friendPlansFeed.alertVisible}
          title={friendPlansFeed.alertTitle}
          message={friendPlansFeed.alertMessage}
          onClose={friendPlansFeed.dismissAlert}
        />
      </View>
    </TouchableWithoutFeedback>
  );
}

function AddFriendsSectionHeader({
  title,
  count,
  isFirst,
  showCount = true,
}: {
  title: string;
  count: number;
  isFirst?: boolean;
  showCount?: boolean;
}) {
  return (
    <View
      style={[
        styles.addFriendsSectionHeader,
        isFirst && styles.addFriendsSectionHeaderFirst,
      ]}
    >
      <Text style={styles.addFriendsSectionLabel}>{title}</Text>
      {showCount && count > 0 ? (
        <View style={styles.friendCountPill}>
          <Text style={styles.friendCountPillText}>{count}</Text>
        </View>
      ) : null}
    </View>
  );
}

function AddFriendsUserRow({
  item,
  subtitle,
  subtitleAccent,
  onPressProfile,
  trailing,
  cardStyle,
  stackTrailing,
}: {
  item: { id: string; displayName?: string; imageurl?: string | null };
  subtitle: string;
  subtitleAccent?: boolean;
  onPressProfile: () => void;
  trailing: React.ReactNode;
  cardStyle?: ViewStyle;
  /** Friend-request rows: name on top, actions below so long names are not clipped. */
  stackTrailing?: boolean;
}) {
  const profileBlock = (
    <TouchableOpacity
      onPress={onPressProfile}
      style={stackTrailing ? styles.addFriendCardMainStacked : styles.addFriendCardMain}
      activeOpacity={0.8}
    >
      <View style={styles.avatarRing}>
        <ExpoImage
          source={{ uri: resolveAvatar(item.imageurl) }}
          style={styles.img}
          cachePolicy="memory-disk"
          transition={120}
        />
      </View>
      <View style={styles.addFriendRowContent}>
        <Text style={styles.friendNameAccent} numberOfLines={stackTrailing ? 2 : 1}>
          {item.displayName || "User"}
        </Text>
        <Text
          style={[
            styles.addFriendSubtitle,
            subtitleAccent && styles.addFriendSubtitleAccent,
          ]}
          numberOfLines={1}
        >
          {subtitle}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (stackTrailing) {
    return (
      <View style={[styles.addFriendRowStacked, cardStyle]}>
        {profileBlock}
        <View style={styles.addFriendRequestActionsStacked}>{trailing}</View>
      </View>
    );
  }

  return (
    <View style={[styles.addFriendRow, cardStyle]}>
      {profileBlock}
      <View style={styles.addFriendCardTrailing}>{trailing}</View>
    </View>
  );
}

const ADD_FRIENDS_SHEET_SPRING = { damping: 30, stiffness: 300, mass: 0.95 };
const ADD_FRIENDS_SHEET_CLOSE_MS = 380;

function SearchModal({
  visible,
  hardwareBackEnabled,
  onClose,
  onOpenProfile,
  currentFriends,
}: {
  visible: boolean;
  hardwareBackEnabled: boolean;
  onClose: () => void;
  onOpenProfile: (friendId: string) => void;
  currentFriends: string[];
}) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const translateY = useSharedValue(9999);
  const sheetHeightRef = useRef(0);
  const [mounted, setMounted] = useState(visible);
  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const listBottomInset = 84 + (Platform.OS === "android" ? insets.bottom : 0);

  const openSheet = useCallback(() => {
    cancelAnimation(translateY);
    if (reducedMotion) {
      translateY.value = 0;
    } else {
      translateY.value = withSpring(0, ADD_FRIENDS_SHEET_SPRING);
    }
  }, [reducedMotion, translateY]);

  const onSheetLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height;
      if (h <= 0) return;
      const prev = sheetHeightRef.current;
      sheetHeightRef.current = h;
      if (!visible) {
        translateY.value = h;
        return;
      }
      if (prev <= 0) {
        translateY.value = h;
        openSheet();
      }
    },
    [visible, openSheet, translateY]
  );

  useEffect(() => {
    if (visible) {
      setMounted(true);
      if (sheetHeightRef.current > 0) openSheet();
      return;
    }
    if (!mounted) return;
    const h = sheetHeightRef.current;
    if (h <= 0) {
      setMounted(false);
      return;
    }
    cancelAnimation(translateY);
    if (reducedMotion) {
      translateY.value = h;
      setMounted(false);
      return;
    }
    translateY.value = withTiming(
      h,
      { duration: ADD_FRIENDS_SHEET_CLOSE_MS, easing: Easing.inOut(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(setMounted)(false);
      }
    );
  }, [visible, mounted, reducedMotion, openSheet, translateY]);
  const [queryText, setQueryText] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [suggested, setSuggested] = useState<any[]>([]);
  const [incomingRequestsRows, setIncomingRequestsRows] = useState<any[]>([]);
  const [outgoingRequestsRows, setOutgoingRequestsRows] = useState<any[]>([]);
  const [pendingRequestIds, setPendingRequestIds] = useState<Record<string, boolean>>({});
  const [incomingRequestIds, setIncomingRequestIds] = useState<Record<string, boolean>>({});
  const [acceptedIds, setAcceptedIds] = useState<Record<string, boolean>>({});
  const [isSearching, setIsSearching] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title?: string;
    message: string;
  } | null>(null);
  const [pendingCancelTarget, setPendingCancelTarget] = useState<any | null>(null);
  const [qrScannerVisible, setQrScannerVisible] = useState(false);
  const [mutualCountsByUserId, setMutualCountsByUserId] = useState<
    Record<string, number>
  >({});

  const formatMutualFriendsSubtitle = (user: any) => {
    const myId = auth.currentUser?.uid ?? "";
    const mutualCount =
      mutualCountsByUserId[user.id] ??
      resolveMutualFriendCount(myId, user.id, user?.mutualCount);
    return `${mutualCount} mutual ${mutualCount === 1 ? "friend" : "friends"}`;
  };

  useEffect(() => {
    if (!visible || !mounted || !hardwareBackEnabled) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, mounted, hardwareBackEnabled, onClose]);

  useEffect(() => {
    if (!visible) {
      setPendingCancelTarget(null);
      setMutualCountsByUserId({});
      setQrScannerVisible(false);
      return;
    }
    setQueryText("");
    setResults([]);
    setIsSearching(false);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [visible]);

  useEffect(() => {
    if (!visible || !auth.currentUser) return;

    const fetchSuggested = () => {
      const myId = auth.currentUser!.uid;
      const applySuggested = (list: any[]) => {
        const visible = list.filter(
          (u) => !currentFriends.includes(u.id) && u.id !== myId
        );
        setSuggested(visible);
        hydratePendingForUsers(visible.map((u) => u.id));
        hydrateIncomingForUsers(visible.map((u) => u.id));
      };

      const cached = suggestedCacheByUser[myId] ?? [];
      if (cached.length > 0) {
        applySuggested(cached);
      }

      void fetchSuggestedFriends()
        .then((serverList) => {
          if (!auth.currentUser || auth.currentUser.uid !== myId) return;
          if (serverList.length > 0) {
            suggestedCacheByUser[myId] = serverList;
            applySuggested(serverList);
          }
        })
        .catch(() => {});

      void warmSuggestedCache(myId)
        .then(() => {
          if (!auth.currentUser || auth.currentUser.uid !== myId) return;
          const next = suggestedCacheByUser[myId] ?? [];
          suggestedCacheByUser[myId] = next;
          applySuggested(next);
        })
        .catch((e) => console.error("[Suggested] refresh failed:", e));
    };

    fetchSuggested();
  }, [visible]);

  useEffect(() => {
    if (!visible || !auth.currentUser) {
      setIncomingRequestsRows([]);
      return;
    }
    const myId = auth.currentUser.uid;
    const reqRef = collection(db, "users", myId, "friendRequests");
    const unsubscribe = onSnapshot(
      reqRef,
      (snapshot) => {
        const rows = snapshot.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          const friendRequestDocId = d.id;
          const senderId =
            (typeof data.from === "string" && data.from) ||
            (typeof data.fromId === "string" && data.fromId) ||
            friendRequestDocId;
          return {
            id: senderId,
            friendRequestDocId,
            displayName:
              (typeof data.senderName === "string" && data.senderName) ||
              (typeof data.fromName === "string" && data.fromName) ||
              "Someone",
            imageurl:
              (typeof data.senderImageUrl === "string" && data.senderImageUrl) ||
              (typeof data.fromImageUrl === "string" && data.fromImageUrl) ||
              (typeof data.fromImageurl === "string" && data.fromImageurl) ||
              null,
          };
        });
        rows.forEach((user) => {
          incomingCheckCacheRef.current[user.id] = true;
        });
        setIncomingRequestsRows(rows);
        setIncomingRequestIds((prev) => {
          const next = { ...prev };
          rows.forEach((r) => {
            next[r.id] = true;
          });
          return next;
        });
        rows.forEach((row) => {
          void getDoc(doc(db, "users", row.id))
            .then((senderSnap) => {
              if (!senderSnap.exists()) return;
              const u = senderSnap.data() as Record<string, unknown>;
              setIncomingRequestsRows((prev) =>
                prev.map((r) =>
                  r.id === row.id
                    ? {
                        ...r,
                        displayName: (u.displayName as string) || r.displayName,
                        imageurl: (u.imageurl as string | null | undefined) ?? r.imageurl,
                      }
                    : r
                )
              );
            })
            .catch(() => {});
        });
      },
      (e) => console.error("[SearchModal] friendRequests snapshot:", e)
    );
    return () => unsubscribe();
  }, [visible]);

  useEffect(() => {
    if (!visible || !auth.currentUser) {
      setOutgoingRequestsRows([]);
      return;
    }
    const myId = auth.currentUser.uid;
    const outgoingRef = collection(db, "users", myId, "outgoingFriendRequests");
    const unsubscribe = onSnapshot(
      outgoingRef,
      (snapshot) => {
        const rows = snapshot.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            displayName:
              (typeof data.displayName === "string" && data.displayName) ||
              (typeof data.toName === "string" && data.toName) ||
              "User",
            imageurl:
              (typeof data.imageurl === "string" && data.imageurl) || null,
          };
        });

        rows.forEach((user) => {
          pendingCheckCacheRef.current[user.id] = true;
        });
        syncOutgoingFriendRequestsCache(
          myId,
          rows.map((r) => r.id)
        );
        setOutgoingRequestsRows(rows);
        setPendingRequestIds((prev) => {
          const next = { ...prev };
          rows.forEach((r) => {
            next[r.id] = true;
          });
          return next;
        });
        rows.forEach((row) => {
          if (row.displayName !== "User" && row.imageurl) return;
          void getDoc(doc(db, "users", row.id))
            .then((recipientSnap) => {
              if (!recipientSnap.exists()) return;
              const u = recipientSnap.data() as Record<string, unknown>;
              setOutgoingRequestsRows((prev) =>
                prev.map((r) =>
                  r.id === row.id
                    ? {
                        ...r,
                        displayName: (u.displayName as string) || r.displayName,
                        imageurl: (u.imageurl as string | null | undefined) ?? r.imageurl,
                      }
                    : r
                )
              );
            })
            .catch(() => {});
        });
      },
      (e) => console.error("[SearchModal] outgoingFriendRequests snapshot:", e)
    );
    return () => unsubscribe();
  }, [visible]);

  const debounceRef = React.useRef<any>(null);
  const pendingCheckCacheRef = React.useRef<Record<string, boolean>>({});
  const pendingCheckInFlightRef = React.useRef<Record<string, Promise<boolean>>>({});
  const incomingCheckCacheRef = React.useRef<Record<string, boolean>>({});
  const incomingCheckInFlightRef = React.useRef<Record<string, Promise<boolean>>>({});

  const hydratePendingForUsers = (userIds: string[]) => {
    if (!auth.currentUser) return;
    const myId = auth.currentUser.uid;
    const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));

    uniqueIds.forEach((targetId) => {
      if (currentFriends.includes(targetId)) {
        pendingCheckCacheRef.current[targetId] = false;
        setPendingRequestIds((prev) => ({ ...prev, [targetId]: false }));
        return;
      }
      if (pendingCheckCacheRef.current[targetId] !== undefined) {
        setPendingRequestIds((prev) => ({
          ...prev,
          [targetId]: pendingCheckCacheRef.current[targetId],
        }));
        return;
      }
      const apply = (isPending: boolean) => {
        pendingCheckCacheRef.current[targetId] = isPending;
        setPendingRequestIds((prev) => ({ ...prev, [targetId]: isPending }));
        setCachedOutgoingFriendRequest(myId, targetId, isPending);
        if (isPending && auth.currentUser) {
          void setDoc(
            doc(db, "users", myId, "outgoingFriendRequests", targetId),
            { to: targetId, sentAt: serverTimestamp() },
            { merge: true }
          ).catch(() => {});
        }
      };
      const inFlight = pendingCheckInFlightRef.current[targetId];
      if (inFlight) {
        void inFlight.then(apply);
        return;
      }
      pendingCheckInFlightRef.current[targetId] = getDoc(
        doc(db, "users", targetId, "friendRequests", myId)
      )
        .then((snap) => snap.exists())
        .catch(() => false)
        .finally(() => {
          delete pendingCheckInFlightRef.current[targetId];
        });
      void pendingCheckInFlightRef.current[targetId].then(apply);
    });
  };

  const hydrateIncomingForUsers = (userIds: string[]) => {
    if (!auth.currentUser) return;
    const myId = auth.currentUser.uid;
    const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));

    uniqueIds.forEach((targetId) => {
      if (currentFriends.includes(targetId) || acceptedIds[targetId]) {
        incomingCheckCacheRef.current[targetId] = false;
        setIncomingRequestIds((prev) => ({ ...prev, [targetId]: false }));
        return;
      }
      if (incomingCheckCacheRef.current[targetId] !== undefined) {
        setIncomingRequestIds((prev) => ({
          ...prev,
          [targetId]: incomingCheckCacheRef.current[targetId],
        }));
        return;
      }
      const apply = (isIncoming: boolean) => {
        incomingCheckCacheRef.current[targetId] = isIncoming;
        setIncomingRequestIds((prev) => ({ ...prev, [targetId]: isIncoming }));
      };
      const inFlight = incomingCheckInFlightRef.current[targetId];
      if (inFlight) {
        void inFlight.then(apply);
        return;
      }
      incomingCheckInFlightRef.current[targetId] = getDoc(
        doc(db, "users", myId, "friendRequests", targetId)
      )
        .then(async (snap) => {
          if (snap.exists()) return true;
          const legacyQ = query(
            collection(db, "users", myId, "friendRequests"),
            where("from", "==", targetId),
            limit(1)
          );
          const legacySnap = await getDocs(legacyQ);
          return !legacySnap.empty;
        })
        .catch(() => false)
        .finally(() => {
          delete incomingCheckInFlightRef.current[targetId];
        });
      void incomingCheckInFlightRef.current[targetId].then(apply);
    });
  };

  const incomingRequestsVisible = useMemo(
    () => incomingRequestsRows.filter((r) => !currentFriends.includes(r.id)),
    [incomingRequestsRows, currentFriends]
  );

  const incomingIds = useMemo(
    () => new Set(incomingRequestsVisible.map((r) => r.id)),
    [incomingRequestsVisible]
  );

  const outgoingRequestsVisible = useMemo(
    () =>
      outgoingRequestsRows.filter(
        (r) => !currentFriends.includes(r.id) && !incomingIds.has(r.id)
      ),
    [outgoingRequestsRows, currentFriends, incomingIds]
  );

  const outgoingIds = useMemo(
    () => new Set(outgoingRequestsVisible.map((r) => r.id)),
    [outgoingRequestsVisible]
  );

  const pymkSuggested = useMemo(
    () =>
      suggested.filter((u) => !incomingIds.has(u.id) && !outgoingIds.has(u.id)),
    [suggested, incomingIds, outgoingIds]
  );

  useEffect(() => {
    if (!visible || !auth.currentUser) return;
    const myId = auth.currentUser.uid;
    const targetIds = [...pymkSuggested, ...results].map((user) => user.id);
    if (targetIds.length === 0) return;

    let cancelled = false;
    void hydrateMutualCountsForUsers(myId, targetIds).then((counts) => {
      if (cancelled) return;
      setMutualCountsByUserId((prev) => ({ ...prev, ...counts }));
    });
    return () => {
      cancelled = true;
    };
  }, [visible, pymkSuggested, results]);

  const addFriendsSections = useMemo(() => {
    const sections: {
      title: string;
      data: any[];
      isFirstSection?: boolean;
    }[] = [];
    if (incomingRequestsVisible.length > 0) {
      sections.push({
        title: "Friend requests",
        data: incomingRequestsVisible,
        isFirstSection: sections.length === 0,
      });
    }
    if (outgoingRequestsVisible.length > 0) {
      sections.push({
        title: "Sent requests",
        data: outgoingRequestsVisible,
        isFirstSection: sections.length === 0,
      });
    }
    if (pymkSuggested.length > 0) {
      sections.push({
        title: "People you may know",
        data: pymkSuggested,
        isFirstSection: sections.length === 0,
      });
    }
    return sections;
  }, [incomingRequestsVisible, outgoingRequestsVisible, pymkSuggested]);

  const searchUsers = (val: string) => {
    setQueryText(val);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      if (val.length < 1) {
        setResults([]);
        return;
      }

      setIsSearching(true);

      try {
        const filtered = await searchUsersForFriend(val);
        setResults(filtered);
        hydratePendingForUsers(filtered.map((u) => u.id));
        hydrateIncomingForUsers(filtered.map((u) => u.id));
      } catch (e) {
        console.error("[SearchModal] Search failed", e);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300); // debounce delay (can tweak 250–400)
  };

  const sendInvite = async (targetUser: any) => {
    if (!auth.currentUser) {
      return;
    }

    const myId = auth.currentUser.uid;
    const targetId = targetUser.id;
    const requestDocRef = doc(
      db,
      "users",
      targetId,
      "friendRequests",
      myId
    );

    try {
      Keyboard.dismiss();
      const meSnap = await getDoc(doc(db, "users", myId));
      const meData = meSnap.exists() ? (meSnap.data() as any) : {};
      const senderName =
        meData?.displayName || auth.currentUser.displayName || "Someone";
      const senderImageUrl = meData?.imageurl || null;

      const payload = {
        from: myId,
        to: targetId,
        senderName,
        senderImageUrl,
        status: "pending",
        sentAt: serverTimestamp(),
      };
      pendingCheckCacheRef.current[targetId] = true;
      setPendingRequestIds((prev) => ({ ...prev, [targetId]: true }));
      setCachedOutgoingFriendRequest(myId, targetId, true);

      setAlertConfig({
        title: "Sent!",
        message: `Invite sent to ${targetUser.displayName}`,
      });
      setAlertVisible(true);

      const outgoingRef = doc(db, "users", myId, "outgoingFriendRequests", targetId);
      const batch = writeBatch(db);
      batch.set(requestDocRef, payload);
      batch.set(outgoingRef, {
        to: targetId,
        displayName: targetUser.displayName || null,
        imageurl: targetUser.imageurl || null,
        sentAt: serverTimestamp(),
      });
      batch.commit().catch((e: any) => {
        pendingCheckCacheRef.current[targetId] = false;
        setPendingRequestIds((prev) => ({ ...prev, [targetId]: false }));
        setCachedOutgoingFriendRequest(myId, targetId, false);
        setAlertConfig({
          title: "Error",
          message: e?.message || "Could not send invite.",
        });
        setAlertVisible(true);
      });

    } catch (e: any) {
      if (e?.code === "permission-denied") {
        setAlertConfig({
          title: "Already sent",
          message: "You’ve already sent this user a friend request.",
        });
        setAlertVisible(true);
        return;
      }

      setAlertConfig({
        title: "Error",
        message: e?.message || "Could not send invite.",
      });
      setAlertVisible(true);
    }
  };

  const cancelOutgoingRequest = async (targetUser: any) => {
    if (!auth.currentUser) return;
    const myId = auth.currentUser.uid;
    const targetId = targetUser.id;

    pendingCheckCacheRef.current[targetId] = false;
    setPendingRequestIds((prev) => ({ ...prev, [targetId]: false }));
    setCachedOutgoingFriendRequest(myId, targetId, false);

    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, "users", targetId, "friendRequests", myId));
      batch.delete(doc(db, "users", myId, "outgoingFriendRequests", targetId));
      await batch.commit();
    } catch (e: any) {
      pendingCheckCacheRef.current[targetId] = true;
      setPendingRequestIds((prev) => ({ ...prev, [targetId]: true }));
      setCachedOutgoingFriendRequest(myId, targetId, true);
      setAlertConfig({
        title: "Error",
        message: e?.message || "Could not cancel request.",
      });
      setAlertVisible(true);
    }
  };

  const handlePendingLongPress = (targetUser: any) => {
    const isPending =
      pendingRequestIds[targetUser.id] || outgoingIds.has(targetUser.id);
    if (!isPending) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPendingCancelTarget(targetUser);
  };

  const acceptIncomingRequest = async (targetUser: any) => {
    if (!auth.currentUser) return;
    const myId = auth.currentUser.uid;
    const senderId = targetUser.id;

    try {
      const meSnap = await getDoc(doc(db, "users", myId));
      const meData = meSnap.exists() ? (meSnap.data() as any) : {};
      const myName = meData?.displayName || auth.currentUser.displayName || "User";
      const myImageUrl = meData?.imageurl || null;
      const senderName = targetUser.displayName || "User";
      const senderImageUrl = targetUser.imageurl || null;

      const batch = writeBatch(db);
      batch.set(doc(db, "users", myId, "friends", senderId), {
        synqCount: 0,
        since: serverTimestamp(),
        displayName: senderName,
        imageurl: senderImageUrl,
        notifyOnCreate: true,
      });
      batch.set(doc(db, "users", senderId, "friends", myId), {
        synqCount: 0,
        since: serverTimestamp(),
        displayName: myName,
        imageurl: myImageUrl,
      });
      const requestDocId = targetUser.friendRequestDocId ?? senderId;
      batch.delete(doc(db, "users", myId, "friendRequests", requestDocId));
      await batch.commit();

      incomingCheckCacheRef.current[senderId] = false;
      setIncomingRequestIds((prev) => ({ ...prev, [senderId]: false }));
      setAcceptedIds((prev) => ({ ...prev, [senderId]: true }));
      await deleteDoc(doc(db, "users", senderId, "friendRequests", myId)).catch(() => {});

      setAlertConfig({
        title: "Success",
        message: `You are now connected with ${senderName}!`,
      });
      setAlertVisible(true);
    } catch (e: any) {
      setAlertConfig({
        title: "Error",
        message: e?.message || "Could not accept request.",
      });
      setAlertVisible(true);
    }
  };

  const declineIncomingRequest = async (targetUser: any) => {
    if (!auth.currentUser) return;
    const myId = auth.currentUser.uid;
    const senderId = targetUser.id;
    const requestDocId = targetUser.friendRequestDocId ?? senderId;

    try {
      Keyboard.dismiss();
      await deleteDoc(doc(db, "users", myId, "friendRequests", requestDocId));
      await deleteDoc(doc(db, "users", senderId, "friendRequests", myId)).catch(() => {});

      incomingCheckCacheRef.current[senderId] = false;
      setIncomingRequestIds((prev) => ({ ...prev, [senderId]: false }));
    } catch (e: any) {
      setAlertConfig({
        title: "Error",
        message: e?.message || "Could not decline request.",
      });
      setAlertVisible(true);
    }
  };

  const seedProfileCache = (user: { id: string; [key: string]: unknown }) => {
    const myId = auth.currentUser?.uid;
    if (!myId || !user?.id) return;
    if (!friendProfileCacheByUser[myId]) {
      friendProfileCacheByUser[myId] = {};
    }
    friendProfileCacheByUser[myId][user.id] = {
      id: user.id,
      displayName: user.displayName,
      imageurl: user.imageurl,
      city: user.city,
      state: user.state,
      interests: user.interests,
      events: user.events,
      location: user.location,
    } as any;
  };

  const openProfile = (user: { id: string; [key: string]: unknown }) => {
    Keyboard.dismiss();
    seedProfileCache(user);
    onOpenProfile(user.id);
  };

  const handleQrFound = (friendId: string) => {
    const myId = auth.currentUser?.uid ?? "";
    setQrScannerVisible(false);
    if (friendId && myId && friendId === myId) {
      setAlertConfig({
        title: "That's your QR code",
        message: "Scan someone else's profile QR code to add them.",
      });
      setAlertVisible(true);
      return;
    }
    Keyboard.dismiss();
    onOpenProfile(friendId);
  };

  const handleInvalidQr = () => {
    setAlertConfig({
      title: "Invalid QR code",
      message: "This doesn't look like a Synq profile QR code. Try scanning the code on their profile.",
    });
    setAlertVisible(true);
  };

  const renderAddActionButton = (
    item: any,
    label: string,
    opts?: {
      onPress?: () => void;
      onLongPress?: () => void;
      disabled?: boolean;
    }
  ) => {
    if (label === "Add") {
      return (
        <SynqPlusAddButton
          onPress={() => opts?.onPress?.()}
          accessibilityLabel="Add friend"
          disabled={opts?.disabled}
          activeOpacity={0.8}
        />
      );
    }
    return (
      <TouchableOpacity
        onPress={opts?.onPress}
        onLongPress={opts?.onLongPress}
        delayLongPress={opts?.onLongPress ? 400 : undefined}
        style={[synqOutlineAddBtnCompact, opts?.disabled && synqOutlineAddBtnDisabled]}
        activeOpacity={0.8}
        disabled={opts?.disabled && !opts?.onLongPress}
      >
        <Text
          style={[
            synqOutlineAddBtnTextCompact,
            opts?.disabled && synqOutlineAddBtnTextDisabled,
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderSuggestedActions = (item: any) => {
    if (acceptedIds[item.id]) {
      return renderAddActionButton(item, "Friends", { disabled: true });
    }
    if (incomingRequestIds[item.id]) {
      return renderAddActionButton(item, "Accept", {
        onPress: () => acceptIncomingRequest(item),
      });
    }
    if (pendingRequestIds[item.id]) {
      return renderAddActionButton(item, "Pending", {
        disabled: true,
        onLongPress: () => handlePendingLongPress(item),
      });
    }
    return renderAddActionButton(item, "Add", {
      onPress: () => sendInvite(item),
    });
  };

  const renderSearchResultActions = (item: any) => {
    if (currentFriends.includes(item.id) || acceptedIds[item.id]) {
      return renderAddActionButton(item, "Friends", { disabled: true });
    }
    if (incomingRequestIds[item.id]) {
      return renderAddActionButton(item, "Accept", {
        onPress: () => acceptIncomingRequest(item),
      });
    }
    if (pendingRequestIds[item.id]) {
      return renderAddActionButton(item, "Pending", {
        disabled: true,
        onLongPress: () => handlePendingLongPress(item),
      });
    }
    return renderAddActionButton(item, "Add", {
      onPress: () => sendInvite(item),
    });
  };

  const renderAddFriendsItem = (item: any, sectionTitle: string) => {
    if (sectionTitle === "Friend requests") {
      return (
        <AddFriendsUserRow
          item={item}
          subtitle="Sent you a request"
          subtitleAccent
          onPressProfile={() => openProfile(item)}
          cardStyle={styles.addFriendCardIncoming}
          stackTrailing
          trailing={
            <View style={styles.addFriendRequestActions}>
              <TouchableOpacity
                onPress={() => declineIncomingRequest(item)}
                style={styles.addFriendDeclineBtn}
                activeOpacity={0.8}
              >
                <Text style={styles.addFriendDeclineBtnText}>Decline</Text>
              </TouchableOpacity>
              {renderAddActionButton(item, "Accept", {
                onPress: () => acceptIncomingRequest(item),
              })}
            </View>
          }
        />
      );
    }
    if (sectionTitle === "Sent requests") {
      return (
        <AddFriendsUserRow
          item={item}
          subtitle="Request sent"
          onPressProfile={() => openProfile(item)}
          trailing={renderAddActionButton(item, "Pending", {
            disabled: true,
            onLongPress: () => handlePendingLongPress(item),
          })}
        />
      );
    }
    return (
      <AddFriendsUserRow
        item={item}
        subtitle={formatMutualFriendsSubtitle(item)}
        onPressProfile={() => openProfile(item)}
        trailing={renderSuggestedActions(item)}
      />
    );
  };

  const addFriendsListEmpty = !queryText && addFriendsSections.length === 0;

  if (!mounted) return null;

  return (
    <>
      <View
        style={styles.addFriendsOverlay}
        pointerEvents={visible ? "auto" : "none"}
        accessibilityViewIsModal
      >
        <Animated.View
          onLayout={onSheetLayout}
          style={[styles.addFriendsSheet, sheetAnimatedStyle]}
        >
      <View style={styles.modalBody}>
        <StatusBar barStyle="light-content" />

        <View style={styles.addFriendsHeader}>
          <Text style={styles.addFriendsTitle}>Add friends</Text>
          <CloseButton
            onPress={onClose}
            accessibilityLabel="Close"
            style={styles.addFriendsCloseBtn}
          />
        </View>

        <View style={[styles.searchBar, styles.addFriendsSearchSpacing]}>
          <Ionicons name="search-outline" size={17} color={MUTED2} />
          <TextInput
            placeholder="Search by name..."
            placeholderTextColor={MUTED3}
            style={styles.searchBarInput}
            value={queryText}
            onChangeText={searchUsers}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {queryText.length > 0 ? (
            <TouchableOpacity
              onPress={() => searchUsers("")}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <CloseIcon variant="inline" />
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity
          style={styles.qrScanRow}
          onPress={() => setQrScannerVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Add user by QR code"
        >
          <Ionicons name="qr-code-outline" size={20} color={ACCENT} />
          <Text style={styles.qrScanRowText}>Add user by QR code</Text>
          <Ionicons name="chevron-forward" size={18} color={MUTED2} />
        </TouchableOpacity>

        {!queryText ? (
          <View style={styles.addFriendsListWrap}>
            {addFriendsListEmpty ? (
              <View style={styles.addFriendsEmpty}>
                <View style={styles.addFriendsEmptyIcon}>
                  <Ionicons name="people-outline" size={28} color={ACCENT} />
                </View>
                <Text style={styles.addFriendsEmptyTitle}>Find your people</Text>
                <Text style={styles.addFriendsEmptyText}>
                  Search by name or check back soon for suggestions based on your network.
                </Text>
              </View>
            ) : (
              <SectionList
                sections={addFriendsSections}
                keyExtractor={(item) => item.id}
                scrollEnabled
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                onScrollBeginDrag={Keyboard.dismiss}
                stickySectionHeadersEnabled={false}
                contentContainerStyle={[
                  styles.addFriendsListContent,
                  { paddingBottom: listBottomInset },
                ]}
                ListFooterComponent={<View style={{ height: 16 }} />}
                SectionSeparatorComponent={() => <View style={styles.addFriendsSectionGap} />}
                renderSectionHeader={({ section }) => (
                  <AddFriendsSectionHeader
                    title={section.title}
                    count={section.data.length}
                    isFirst={section.isFirstSection}
                    showCount={section.title !== "People you may know"}
                  />
                )}
                ItemSeparatorComponent={() => <View style={styles.friendRowSeparator} />}
                renderItem={({ item, section }) =>
                  renderAddFriendsItem(item, section.title)
                }
              />
            )}
          </View>
        ) : (
          <View style={styles.addFriendsListWrap}>
            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={[
                styles.addFriendsListContent,
                { paddingBottom: listBottomInset },
                results.length === 0 && styles.addFriendsListContentEmpty,
              ]}
              ListFooterComponent={<View style={{ height: 16 }} />}
              ItemSeparatorComponent={() => <View style={styles.friendRowSeparator} />}
              ListEmptyComponent={
                isSearching ? (
                  <View style={styles.addFriendsEmpty}>
                    <ActivityIndicator color={ACCENT} />
                  </View>
                ) : (
                  <View style={styles.addFriendsEmpty}>
                    <Text style={styles.addFriendsEmptyTitle}>No results</Text>
                    <Text style={styles.addFriendsEmptyText}>
                      Try a different name or spelling.
                    </Text>
                  </View>
                )
              }
              renderItem={({ item }) => (
                <AddFriendsUserRow
                  item={item}
                  subtitle={formatMutualFriendsSubtitle(item)}
                  onPressProfile={() => openProfile(item)}
                  trailing={renderSearchResultActions(item)}
                />
              )}
            />
          </View>
        )}
        </View>
        </Animated.View>
      </View>
      <ConfirmModal
        visible={pendingCancelTarget != null}
        title="Cancel friend request?"
        message={`Withdraw your request to ${
          pendingCancelTarget?.displayName || "this user"
        }?`}
        cancelText="Keep pending"
        confirmText="Cancel request"
        destructive
        onCancel={() => setPendingCancelTarget(null)}
        onConfirm={() => {
          const target = pendingCancelTarget;
          setPendingCancelTarget(null);
          if (target) void cancelOutgoingRequest(target);
        }}
      />
      <AlertModal
        visible={alertVisible}
        title={alertConfig?.title}
        message={alertConfig?.message || ""}
        onClose={() => setAlertVisible(false)}
      />
      <ProfileQrScannerModal
        visible={qrScannerVisible}
        onClose={() => setQrScannerVisible(false)}
        onFound={handleQrFound}
        onInvalidCode={handleInvalidQr}
      />
    </>
  );
}

/** Friends tab search fade gradient. */
const FRIENDS_SEARCH_FADE_GRADIENT = [
  BG,
  BG_FADE_HEAVY,
  BG_TRANSPARENT,
] as const;

const styles = StyleSheet.create({
  screenRoot: { flex: 1, backgroundColor: BG },
  container: {
    flex: 1,
    backgroundColor: BG,
    position: "relative",
  },
  screenPadding: {
    paddingHorizontal: 20,
  },
  addFriendsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    zIndex: 100,
    elevation: 100,
  },
  addFriendsSheet: {
    width: "100%",
    height: "94%",
    backgroundColor: BG,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: "hidden",
    shadowColor: SHADOW,
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -6 },
    elevation: 24,
  },
  headerBlock: {
    marginBottom: 4,
    zIndex: 2,
  },
  headerScrollFade: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 56,
    zIndex: 10,
    elevation: 10,
  },
  friendRowSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER,
  },
  headerTitle: {
    ...tabScreenMainHeaderTitle,
    flex: 1,
    lineHeight: 32,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  headerAddBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
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
    flex: 1,
    color: TEXT,
    fontFamily: fonts.book,
    fontSize: TYPE_BODY,
    paddingVertical: 0,
    minHeight: 22,
  },
  skeletonBlock: {
    backgroundColor: SURFACE_RAISED,
    borderRadius: 8,
  },
  sortBar: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    marginTop: SPACE_3,
    marginBottom: 14,
  },
  friendCountPill: {
    minWidth: 0,
    paddingHorizontal: 0,
    backgroundColor: "transparent",
    borderWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  friendCountPillText: {
    color: MUTED3,
    fontSize: TYPE_LEAD,
    fontFamily: fonts.book,
    lineHeight: 26,
    includeFontPadding: false,
    fontVariant: ["tabular-nums"],
  },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  addFriendRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    minWidth: 0,
  },
  addFriendRowStacked: {
    paddingVertical: 14,
    minWidth: 0,
  },
  addFriendCardMainStacked: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
    paddingRight: 0,
  },
  addFriendRequestActionsStacked: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 10,
    marginLeft: 60,
  },
  friendRowContent: { flex: 1, justifyContent: "center" },
  friendRowName: {
    marginBottom: 3,
  },
  friendNameAccent: {
    ...listRowTitleText,
    fontFamily: fonts.heavy,
    letterSpacing: 0.05,
  },
  friendRowMeta: { flexDirection: "row", alignItems: "center" },
  friendRowMetaIcon: { marginRight: 4 },
  friendRowLocation: {
    ...cardMetaText,
    flex: 1,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: SURFACE_MUTED,
    marginLeft: 69,
  },
  avatar: {
    width: 55,
    height: 55,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
    overflow: "hidden",
  },
  avatarRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    overflow: "hidden",
    backgroundColor: SURFACE_INPUT,
  },
  img: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  friendName: { ...listRowTitleText, fontFamily: fonts.heavy },
  mutualText: { ...cardMetaText, marginTop: 3 },
  friendsLoadErrorWrap: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: RADIUS_MD,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
  },
  friendsLoadErrorText: {
    color: MUTED2,
    fontFamily: fonts.medium,
    fontSize: TYPE_BODY,
    textAlign: "center",
  },
  friendsLoadErrorRetry: {
    color: ACCENT,
    fontFamily: fonts.heavy,
    fontSize: TYPE_BODY,
    textAlign: "center",
    marginTop: 8,
  },
  friendsList: { flex: 1, width: "100%" },
  friendsListContent: { paddingBottom: TAB_BAR_SCROLL_INSET },
  friendsListContentEmpty: { flexGrow: 1, paddingBottom: TAB_BAR_SCROLL_INSET },
  emptyStateCenter: {
    flex: 1,
    paddingTop: SPACE_5,
    paddingHorizontal: SPACE_3,
    paddingBottom: SPACE_5,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 360,
  },
  emptyStateMain: {
    flex: 1,
    paddingHorizontal: SPACE_5,
    paddingVertical: SPACE_6,
    alignItems: "center",
    justifyContent: "center",
    maxWidth: 420,
    width: "100%",
    alignSelf: "center",
  },
  emptyHeroBlock: {
    alignItems: "center",
    width: "100%",
  },
  emptyHeroTitle: {
    color: TEXT,
    fontFamily: fonts.heavy,
    fontSize: TYPE_DISPLAY,
    lineHeight: 40,
    letterSpacing: 0.2,
    textAlign: "center",
    width: "100%",
  },
  emptyHeroAccent: {
    color: ACCENT,
    fontFamily: fonts.heavy,
    fontSize: TYPE_DISPLAY,
    lineHeight: 40,
    letterSpacing: 0.2,
  },
  emptyHeroSubtitle: {
    color: MUTED,
    fontFamily: fonts.medium,
    fontSize: TYPE_BODY,
    lineHeight: 24,
    textAlign: "center",
    marginTop: SPACE_5,
    maxWidth: 340,
  },
  emptyHeroHint: {
    color: MUTED2,
    fontFamily: fonts.book,
    fontSize: TYPE_LEAD,
    lineHeight: 20,
    textAlign: "center",
    marginTop: SPACE_4,
    maxWidth: 320,
  },
  emptyPrimaryCtaWrap: {
    alignSelf: "center",
    marginTop: SPACE_6 + SPACE_3,
  },
  emptyPrimaryCta: {
    flexDirection: "row",
    gap: SPACE_3,
  },
  emptySecondaryBtn: { marginTop: SPACE_4, paddingVertical: 8, paddingHorizontal: 12 },
  emptySecondaryBtnText: { color: ACCENT, fontFamily: fonts.heavy, fontSize: TYPE_BUTTON },
  emptyContainer: { flex: 1, justifyContent: "center", marginTop: 30, paddingHorizontal: 10 },
  emptyCard: {
    backgroundColor: SURFACE,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 18,
  },
  emptyTitle: { ...listRowTitleText, fontFamily: fonts.heavy, textAlign: "center" },
  emptyText: { ...cardMetaText, color: MUTED, textAlign: "center", marginTop: 12, lineHeight: 20, paddingHorizontal: 8 },
  popupOverlay: {
    flex: 1,
    backgroundColor: OVERLAY_HEAVY,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 18,
  },
  popupContent: {
    width: width * 0.9,
    maxHeight: "86%",
    backgroundColor: OVERLAY_PANEL,
    borderRadius: 28,
    padding: 22,
    alignItems: "center",
    borderWidth: 1,
    borderColor: BORDER,
  },
  closeBtn: { position: "absolute", top: 16, right: 16, padding: 8, zIndex: 2 },
  largeAvatar: {
    width: 108,
    height: 108,
    borderRadius: 54,
    marginTop: 10,
    marginBottom: 14,
    borderWidth: 2,
    borderColor: ACCENT,
  },
  popupName: { ...profileNameText, letterSpacing: 0.2 },
  popupLocation: { ...cardMetaText, marginTop: 6, color: MUTED3 },
  popupLocationText: { ...cardMetaText, color: MUTED3 },
  interestsContainer: { width: "100%", marginTop: 10, marginBottom: 10 },
  sectionLabel: profileScreenSectionTitle,
  interestsScroll: { maxHeight: 150, width: "100%" },
  interestsWrapper: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", paddingBottom: 4 },
  interestPill: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  interestText: { color: TEXT, fontFamily: fonts.book, fontSize: TYPE_CAPTION },
  noInterestsText: {
    color: MUTED2,
    fontSize: TYPE_CAPTION,
    fontFamily: fonts.book,
    fontStyle: "italic",
    textAlign: "left",
    alignSelf: "flex-start",
    width: "100%",
  },
  removeBtn: { marginTop: 14, paddingVertical: 10, paddingHorizontal: 12 },
  removeBtnText: { color: DESTRUCTIVE, fontFamily: fonts.heavy, fontSize: TYPE_LEAD },
  modalBody: {
    flex: 1,
    backgroundColor: BG,
    paddingHorizontal: 20,
    paddingTop: 32,
  },
  addFriendsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  addFriendsSearchSpacing: {
    marginTop: 0,
    marginBottom: 12,
  },
  qrScanRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: RADIUS_MD,
    backgroundColor: SURFACE_INPUT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: FRIENDS_SEARCH_BORDER,
  },
  qrScanRowText: {
    flex: 1,
    color: TEXT,
    fontFamily: fonts.book,
    fontSize: TYPE_BODY,
  },
  addFriendsTitle: {
    ...stackScreenHeaderTitle,
    flex: 1,
    marginRight: SPACE_3,
    lineHeight: 30,
    includeFontPadding: false,
  },
  addFriendsCloseBtn: {
    marginTop: -3,
  },
  addFriendsListWrap: { flex: 1 },
  addFriendsListContent: {},
  addFriendsListContentEmpty: { flexGrow: 1 },
  addFriendsSectionLabel: {
    flex: 1,
    color: MUTED2,
    fontSize: TYPE_LEAD,
    fontFamily: fonts.medium,
    letterSpacing: 0.2,
    lineHeight: 20,
    includeFontPadding: false,
  },
  addFriendsSectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginTop: 18,
    marginBottom: 8,
    minHeight: 18,
  },
  addFriendsSectionHeaderFirst: {
    marginTop: 0,
  },
  addFriendsSectionGap: { height: 8 },
  addFriendCardIncoming: {
    borderLeftWidth: 2,
    borderLeftColor: ACCENT_BORDER,
    paddingLeft: 10,
  },
  addFriendCardMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
    paddingRight: 10,
  },
  addFriendRowContent: { flex: 1, justifyContent: "center", minWidth: 0 },
  addFriendSubtitle: {
    color: MUTED2,
    fontSize: TYPE_CAPTION,
    fontFamily: fonts.book,
    marginTop: 3,
  },
  addFriendSubtitleAccent: {
    color: ACCENT,
    fontFamily: fonts.medium,
  },
  addFriendCardTrailing: {
    flexShrink: 0,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  addFriendRequestActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  addFriendDeclineBtn: {
    backgroundColor: SURFACE_INPUT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: FRIENDS_BORDER,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: BUTTON_RADIUS,
  },
  addFriendDeclineBtnText: {
    color: MUTED2,
    fontFamily: fonts.heavy,
    fontSize: TYPE_CAPTION,
    letterSpacing: 0.15,
  },
  addFriendsEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACE_5,
    paddingBottom: 48,
  },
  addFriendsEmptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: SURFACE_RAISED,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: FRIENDS_BORDER,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACE_4,
  },
  addFriendsEmptyTitle: {
    color: TEXT,
    fontFamily: fonts.heavy,
    fontSize: TYPE_CTA,
    letterSpacing: 0.15,
    textAlign: "center",
  },
  addFriendsEmptyText: {
    color: MUTED2,
    fontFamily: fonts.book,
    fontSize: TYPE_LEAD,
    lineHeight: 21,
    textAlign: "center",
    marginTop: SPACE_3,
    maxWidth: 300,
  },
});
