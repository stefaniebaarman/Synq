import {
  ACCENT,
  BG,
  BORDER,
  cardMetaText,
  Friend,
  fonts,
  MODAL_RADIUS,
  MUTED2,
  MUTED3,
  ON_ACCENT_TEXT,
  profileInterestPillText,
  profileInterestPillTextActive,
  RADIUS_LG,
  SURFACE,
  TEXT,
  TYPE_BODY,
  TYPE_CAPTION,
  TYPE_TITLE,
} from "@/constants/Variables";
import CloseButton from "@/src/components/CloseButton";
import CommunityGroupListAvatar from "@/src/components/friends/CommunityGroupListAvatar";
import {
  GROUP_BORDER,
  GROUP_SURFACE,
  groupsPageStyles,
} from "@/src/components/friends/groupsListStyles";
import { COMMUNITY_GROUP_CATEGORIES } from "@/src/lib/communityGroupCategories";
import {
  CommunityGroup,
  fetchAllCommunityGroups,
  joinCommunityGroup,
  searchCommunityGroups,
} from "@/src/lib/communityGroups";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  visible: boolean;
  userId: string;
  friends: Friend[];
  joinedGroupIds: Set<string>;
  onClose: () => void;
  onJoined: (groupId: string) => void;
  onOpenGroup: (groupId: string) => void;
};

const LIST_GAP = 10;
const NAV_SIDE = 44;
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

export default function CommunityGroupSearchSheet({
  visible,
  userId,
  friends,
  joinedGroupIds,
  onClose,
  onJoined,
  onOpenGroup,
}: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CommunityGroup[]>([]);
  const [searching, setSearching] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [allGroups, setAllGroups] = useState<CommunityGroup[]>([]);
  const [allGroupsLoading, setAllGroupsLoading] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const dismissKeyboard = () => Keyboard.dismiss();
  const listContentPadding = { paddingBottom: Math.max(insets.bottom, 16) + 12 };

  useEffect(() => {
    if (!visible) {
      setKeyboardOpen(false);
      return;
    }

    const onShow = () => setKeyboardOpen(true);
    const onHide = () => setKeyboardOpen(false);
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvt, onShow);
    const hideSub = Keyboard.addListener(hideEvt, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      setQuery("");
      setResults([]);
      setSearching(false);
      setJoiningId(null);
      setSelectedCategory(null);
      setAllGroups([]);
      setAllGroupsLoading(false);
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
        searchTimerRef.current = null;
      }
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;

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
  }, [query, visible]);

  useEffect(() => {
    if (!visible) return;

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
  }, [visible]);

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
      onJoined(group.id);
      onOpenGroup(group.id);
      onClose();
    } catch (err: unknown) {
      Alert.alert(
        "Could not join",
        err instanceof Error ? err.message : "Try again."
      );
    } finally {
      setJoiningId(null);
    }
  };

  const handleBackdropPress = () => {
    if (keyboardOpen) {
      dismissKeyboard();
      return;
    }
    onClose();
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
      <TouchableOpacity
        style={groupsPageStyles.circleCard}
        activeOpacity={0.78}
        onPress={() => {
          dismissKeyboard();
          onOpenGroup(item.id);
          onClose();
        }}
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
          <TouchableOpacity
            style={[groupsPageStyles.joinBtn, busy && groupsPageStyles.joinBtnDisabled]}
            disabled={busy}
            onPress={() => void handleJoin(item)}
            accessibilityRole="button"
            accessibilityLabel={`Join ${item.name}`}
          >
            {busy ? (
              <ActivityIndicator color={ON_ACCENT_TEXT} size="small" />
            ) : (
              <Text style={groupsPageStyles.joinBtnText}>Join</Text>
            )}
          </TouchableOpacity>
        )}
      </TouchableOpacity>
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
        <ActivityIndicator color={ACCENT} />
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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleBackdropPress}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleBackdropPress} accessibilityLabel="Dismiss" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom }]}>
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>

          <TouchableWithoutFeedback onPress={dismissKeyboard} accessible={false}>
            <View style={styles.sheetHeader}>
              <View style={styles.headerRow}>
                <View style={styles.headerTitleWrap}>
                  <Text style={styles.title}>Discover</Text>
                </View>
                <CloseButton onPress={onClose} style={styles.navIconBtnTrailing} />
              </View>
            </View>
          </TouchableWithoutFeedback>

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
              <TouchableOpacity onPress={() => setQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={18} color={MUTED2} />
              </TouchableOpacity>
            ) : null}
          </View>

          {renderCategoryChips()}

          <View style={styles.listArea} {...listTouchProps}>
            {listContent}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "flex-end",
  },
  sheet: {
    flex: 1,
    maxHeight: "94%",
    backgroundColor: BG,
    borderTopLeftRadius: MODAL_RADIUS + 8,
    borderTopRightRadius: MODAL_RADIUS + 8,
    paddingHorizontal: CONTENT_PAD_X,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    borderColor: GROUP_BORDER,
  },
  handleWrap: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 16,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  sheetHeader: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: NAV_SIDE,
    gap: 4,
  },
  headerTitleWrap: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  navIconBtnTrailing: {
    width: NAV_SIDE,
    height: NAV_SIDE,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginRight: -10,
  },
  title: {
    color: TEXT,
    fontSize: TYPE_TITLE,
    lineHeight: 32,
    fontFamily: fonts.heavy,
    letterSpacing: 0.15,
  },
  searchRow: {
    ...groupsPageStyles.searchBar,
    marginBottom: 16,
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
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  categoryChipOn: {
    backgroundColor: "rgba(0,255,133,0.12)",
    borderColor: "rgba(0,255,133,0.55)",
  },
  categoryChipText: profileInterestPillText,
  categoryChipTextOn: profileInterestPillTextActive,
  searchInput: {
    flex: 1,
    fontFamily: fonts.book,
    fontSize: TYPE_BODY,
    color: TEXT,
    padding: 0,
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
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GROUP_BORDER,
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
    borderColor: GROUP_BORDER,
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
