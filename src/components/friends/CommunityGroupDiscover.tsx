import AlertModal from "@/app/alert-modal";
import {
  BG,
  BORDER_SUBTLE_HEX,
  MUTED2,
  MUTED3,
  RADIUS_LG,
  SURFACE_ELEVATED,
  SYNQ_OUTLINE_CTA_RADIUS,
  TYPE_BODY,
  TYPE_CAPTION,
  cardMetaText,
  fonts,
  formInputText,
  profileInterestPillText,
  profileInterestPillTextActive,
} from "@/constants/Variables";
import { ListRowsSkeleton } from "@/src/components/loading/BrandSkeletons";
import CommunityGroupListAvatar from "@/src/components/friends/CommunityGroupListAvatar";
import GroupListCard, {
  GROUP_LIST_ANDROID_RIPPLE,
} from "@/src/components/friends/GroupListCard";
import {
  GROUP_SURFACE,
  groupsPageStyles,
} from "@/src/components/friends/groupsListStyles";
import StackScreenHeader from "@/src/components/StackScreenHeader";
import { COMMUNITY_GROUP_CATEGORIES } from "@/src/lib/communityGroupCategories";
import {
  CommunityGroup,
  fetchAllCommunityGroups,
  joinCommunityGroup,
  searchCommunityGroups,
  subscribeJoinedCommunityGroups,
} from "@/src/lib/communityGroups";
import { auth } from "@/src/lib/firebase";
import { communityGroupsCacheByUser } from "@/src/lib/socialCache";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const LIST_GAP = 10;
const CONTENT_PAD_X = 20;

function formatMemberCount(count: number): string {
  return count === 1 ? "1 member" : `${count} members`;
}

function sortGroupsByName(groups: CommunityGroup[]): CommunityGroup[] {
  return [...groups].sort((a, b) => a.name.localeCompare(b.name));
}

function filterGroupsByCategory(
  groups: CommunityGroup[],
  category: string | null
): CommunityGroup[] {
  if (!category) return groups;
  return groups.filter((group) => group.category === category);
}

function ListGap() {
  return <View style={styles.listGap} />;
}

export default function CommunityGroupDiscover() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = auth.currentUser?.uid ?? "";
  const cached = userId ? communityGroupsCacheByUser[userId] ?? [] : [];
  const [joined, setJoined] = useState<CommunityGroup[]>(cached);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CommunityGroup[]>([]);
  const [searching, setSearching] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [allGroups, setAllGroups] = useState<CommunityGroup[]>([]);
  const [allGroupsLoading, setAllGroupsLoading] = useState(true);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState<string | undefined>();
  const [alertMessage, setAlertMessage] = useState("");

  const joinedGroupIds = useMemo(() => new Set(joined.map((g) => g.id)), [joined]);

  const showAlert = useCallback((title: string, message: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  }, []);

  const dismissKeyboard = () => Keyboard.dismiss();
  const listContentPadding = { paddingBottom: Math.max(insets.bottom, 16) + 12 };

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/friends");
  };

  const openGroup = (id: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: "/community-group/[id]", params: { id } });
  };

  useEffect(() => {
    if (!userId) return;
    const unsub = subscribeJoinedCommunityGroups(
      userId,
      (next) => {
        communityGroupsCacheByUser[userId] = next;
        setJoined(next);
      },
      () => {}
    );
    return unsub;
  }, [userId]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      void searchCommunityGroups(trimmed)
        .then((groups) => setResults(sortGroupsByName(groups)))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 280);

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    setAllGroupsLoading(true);
    void fetchAllCommunityGroups()
      .then((groups) => {
        if (!cancelled) setAllGroups(sortGroupsByName(groups));
      })
      .catch(() => {
        if (!cancelled) setAllGroups([]);
      })
      .finally(() => {
        if (!cancelled) setAllGroupsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const trimmed = query.trim();

  const displayGroups = useMemo(() => {
    const base = trimmed ? results : allGroups;
    return sortGroupsByName(filterGroupsByCategory(base, selectedCategory));
  }, [trimmed, results, allGroups, selectedCategory]);

  const listLoading = trimmed ? searching : allGroupsLoading;

  const handleJoin = async (group: CommunityGroup) => {
    if (!userId || joiningId) return;
    setJoiningId(group.id);
    try {
      await joinCommunityGroup(userId, group.id, group.memberIds);
      openGroup(group.id);
    } catch (err: unknown) {
      showAlert(
        "Could not join",
        err instanceof Error ? err.message : "Try again."
      );
    } finally {
      setJoiningId(null);
    }
  };

  const selectCategory = (category: string | null) => {
    dismissKeyboard();
    setSelectedCategory(category);
  };

  const listTouchProps = {
    onStartShouldSetResponder: () => {
      dismissKeyboard();
      return false;
    },
  } as const;

  const renderGroupRow = (item: CommunityGroup) => {
    const isJoined = joinedGroupIds.has(item.id);
    const busy = joiningId === item.id;

    return (
      <GroupListCard
        onPress={() => {
          dismissKeyboard();
          openGroup(item.id);
        }}
        accessibilityLabel={`${item.name}, ${formatMemberCount(item.memberIds.length)}`}
      >
        <CommunityGroupListAvatar
          coverPhotoUrl={item.coverPhotoUrl}
          coverPhotoThumbUrl={item.coverPhotoThumbUrl}
        />
        <View style={groupsPageStyles.circleCardMain}>
          <Text style={groupsPageStyles.circleCardTitle} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={groupsPageStyles.circleCardMeta} numberOfLines={1}>
            {formatMemberCount(item.memberIds.length)}
            {item.category ? ` · ${item.category}` : ""}
            {item.location ? ` · ${item.location}` : ""}
          </Text>
        </View>
        {isJoined ? (
          <View style={styles.joinedPill}>
            <Text style={styles.joinedPillText}>Joined</Text>
          </View>
        ) : (
          <Pressable
            style={[groupsPageStyles.joinBtn, busy && groupsPageStyles.joinBtnDisabled]}
            disabled={busy}
            android_ripple={
              Platform.OS === "android" ? GROUP_LIST_ANDROID_RIPPLE : undefined
            }
            onPress={() => void handleJoin(item)}
            accessibilityRole="button"
            accessibilityLabel={`Join ${item.name}`}
          >
            <Text style={[groupsPageStyles.joinBtnText, busy && { opacity: 0.5 }]}>
              Join
            </Text>
          </Pressable>
        )}
      </GroupListCard>
    );
  };

  const renderCategoryChips = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.categoryChipsWrap}
      style={styles.categoryChipsScroll}
    >
      <TouchableOpacity
        style={[styles.categoryChip, selectedCategory === null && styles.categoryChipOn]}
        onPress={() => selectCategory(null)}
        activeOpacity={0.78}
        accessibilityRole="button"
        accessibilityState={{ selected: selectedCategory === null }}
        accessibilityLabel="Show all communities"
      >
        <Text
          style={[
            styles.categoryChipText,
            selectedCategory === null && styles.categoryChipTextOn,
          ]}
        >
          All
        </Text>
      </TouchableOpacity>
      {COMMUNITY_GROUP_CATEGORIES.map((category) => {
        const active = selectedCategory === category;
        return (
          <TouchableOpacity
            key={category}
            style={[styles.categoryChip, active && styles.categoryChipOn]}
            onPress={() => selectCategory(category)}
            activeOpacity={0.78}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Filter by ${category}`}
          >
            <Text style={[styles.categoryChipText, active && styles.categoryChipTextOn]}>
              {category}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  const emptyMessage = trimmed
    ? selectedCategory
      ? `No groups found for "${trimmed}" in ${selectedCategory}.`
      : `No groups found for "${trimmed}".`
    : selectedCategory
      ? `No communities in ${selectedCategory} yet.`
      : "No communities yet.";

  let listContent: React.ReactNode;

  if (listLoading) {
    listContent = (
      <Pressable style={styles.centered} onPress={dismissKeyboard}>
        <ListRowsSkeleton />
      </Pressable>
    );
  } else if (displayGroups.length === 0) {
    listContent = (
      <Pressable style={styles.emptyPressable} onPress={dismissKeyboard}>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyHint}>{emptyMessage}</Text>
        </View>
      </Pressable>
    );
  } else {
    listContent = (
      <FlatList
        data={displayGroups}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onScrollBeginDrag={dismissKeyboard}
        style={styles.list}
        contentContainerStyle={listContentPadding}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          trimmed ? (
            <Text style={styles.resultsLabel}>
              {displayGroups.length === 1 ? "1 result" : `${displayGroups.length} results`}
            </Text>
          ) : null
        }
        renderItem={({ item }) => renderGroupRow(item)}
        ItemSeparatorComponent={ListGap}
      />
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["bottom", "left", "right"]}>
      <StackScreenHeader title="Discover" onBack={goBack} />

      <View style={styles.body}>
        <View style={styles.searchRow}>
          <Ionicons name="search" size={17} color={MUTED3} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name"
            placeholderTextColor={MUTED3}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            onSubmitEditing={() => Keyboard.dismiss()}
          />
          {query.length > 0 ? (
            <TouchableOpacity
              onPress={() => setQuery("")}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={18} color={MUTED2} />
            </TouchableOpacity>
          ) : null}
        </View>

        {renderCategoryChips()}

        <View style={styles.listArea} {...listTouchProps}>
          {listContent}
        </View>
      </View>

      <AlertModal
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        onClose={() => setAlertVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  body: {
    flex: 1,
    paddingHorizontal: CONTENT_PAD_X,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 48,
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 16,
    borderRadius: 999,
    backgroundColor: GROUP_SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER_SUBTLE_HEX,
    overflow: "visible",
  },
  categoryChipsScroll: {
    flexGrow: 0,
    marginBottom: 16,
    marginHorizontal: -CONTENT_PAD_X,
  },
  categoryChipsWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: CONTENT_PAD_X,
  },
  categoryChip: {
    backgroundColor: SURFACE_ELEVATED,
    borderWidth: 1,
    borderColor: BORDER_SUBTLE_HEX,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  categoryChipOn: {
    backgroundColor: SURFACE_ELEVATED,
    borderColor: BORDER_SUBTLE_HEX,
  },
  categoryChipText: profileInterestPillText,
  categoryChipTextOn: profileInterestPillTextActive,
  searchInput: {
    flex: 1,
    alignSelf: "stretch",
    ...formInputText,
    lineHeight: 22,
    paddingTop: 13,
    paddingBottom: 13,
    paddingHorizontal: 0,
    margin: 0,
    textAlignVertical: "center",
    ...(Platform.OS === "android" ? { includeFontPadding: false } : null),
  },
  listArea: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  listGap: {
    height: LIST_GAP,
  },
  resultsLabel: {
    ...cardMetaText,
    marginBottom: 12,
  },
  joinedPill: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: SYNQ_OUTLINE_CTA_RADIUS,
    backgroundColor: SURFACE_ELEVATED,
    borderWidth: Platform.OS === "android" ? 1 : StyleSheet.hairlineWidth,
    borderColor: BORDER_SUBTLE_HEX,
  },
  joinedPillText: {
    fontFamily: fonts.medium,
    fontSize: TYPE_CAPTION,
    color: MUTED2,
    letterSpacing: 0.03,
  },
  centered: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyCard: {
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderRadius: RADIUS_LG,
    backgroundColor: GROUP_SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER_SUBTLE_HEX,
  },
  emptyHint: {
    ...cardMetaText,
    fontSize: TYPE_BODY,
    textAlign: "center",
    lineHeight: 22,
  },
  emptyPressable: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
});
