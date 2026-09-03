import type { Friend } from "@/constants/Variables";
import { SkeletonBlock } from "@/src/components/loading/BrandSkeletons";
import ActiveSynqEmptyState from "@/src/components/synq/ActiveSynqEmptyState";
import NotificationBadge from "@/src/components/NotificationBadge";
import { friendLocationWithDistance } from "@/src/lib/friendDistance";
import { friendLocationLine, resolveAvatar } from "@/src/lib/helpers";
import { SYNQ_TAB_LONG_PRESS } from "@/src/lib/synqTabEvents";
import { useSortedFriendsList } from "@/src/lib/useSortedFriendsList";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  DeviceEventEmitter,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import SynqOptionsSheet from "../../../app/synq-screens/SynqOptionsSheet";
import {
  ACCENT,
  ACCENT_BORDER,
  BG,
  BG_TRANSPARENT,
  BORDER,
  MUTED,
  MUTED2,
  MUTED3,
  RADIUS_MD,
  SURFACE_INPUT,
  TAB_BAR_SCROLL_INSET,
  TEXT,
  TYPE_BODY,
  TYPE_BUTTON,
  TYPE_CAPTION,
  TYPE_MICRO,
  fonts,
  listRowTitleText,
  synqOutlineAddBtn,
  synqOutlineAddBtnDisabled,
  synqOutlineAddBtnText,
  synqOutlineAddBtnTextDisabled,
} from "../../../constants/Variables";

const LIVE_PULSE_SIZE = 8;
const FRIEND_CARD_BORDER_WIDTH =
  Platform.OS === "android" ? 1 : StyleSheet.hairlineWidth;
const MEMO_PLACEHOLDER = "Add a status…";
const STATUS_DIVIDER = "rgba(255,255,255,0.08)";
const ACTIVE_LIST_BOTTOM_FADE_HEIGHT = 72;
const ACTIVE_CTA_BOTTOM_NUDGE = 64;
const ACTIVE_CTA_HEIGHT = 48;
const SHORT_LIST_MAX = 3;
const ACTIVE_CTA_BOTTOM_NUDGE_SHORT = 44;

function ActiveLiveDot() {
  const reduced = useReducedMotion();
  const ring = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      ring.value = 0;
      return;
    }
    ring.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 0 })
      ),
      -1,
      false
    );
  }, [reduced, ring]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - ring.value),
    transform: [{ scale: 1 + ring.value * 1.55 }],
  }));

  return (
    <View style={pulseStyles.wrap} accessibilityElementsHidden>
      {reduced ? null : (
        <Animated.View style={[pulseStyles.ring, ringStyle]} />
      )}
      <View style={pulseStyles.core} />
    </View>
  );
}

const pulseStyles = {
  wrap: {
    width: LIVE_PULSE_SIZE + 14,
    height: LIVE_PULSE_SIZE + 14,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  ring: {
    position: "absolute" as const,
    width: LIVE_PULSE_SIZE,
    height: LIVE_PULSE_SIZE,
    borderRadius: LIVE_PULSE_SIZE / 2,
    backgroundColor: ACCENT,
  },
  core: {
    width: LIVE_PULSE_SIZE,
    height: LIVE_PULSE_SIZE,
    borderRadius: LIVE_PULSE_SIZE / 2,
    backgroundColor: ACCENT,
  },
};

type Props = {
  styles: any;
  unreadCount: number;
  availableFriends: any[];
  selectedFriends: string[];
  setSelectedFriends: React.Dispatch<React.SetStateAction<string[]>>;
  handleConnect: () => void;
  memo?: string;
  isConnecting?: boolean;
  endSynq: () => void;
  openMessagesInbox: () => void;
  openEditModal: () => void;
  openChangeAudience?: () => void;
  audienceLabel?: string | null;
  userProfile?: Record<string, unknown> | null;
  viewerId?: string;
  nudgeCandidates?: Friend[];
  friendsLoading?: boolean;
};

export default function ActiveSynqSection({
  styles: parentStyles,
  unreadCount,
  availableFriends,
  selectedFriends,
  setSelectedFriends,
  handleConnect,
  memo = "",
  isConnecting = false,
  endSynq,
  openMessagesInbox,
  openEditModal,
  openChangeAudience,
  audienceLabel,
  userProfile,
  viewerId,
  nudgeCandidates = [],
  friendsLoading = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const [optionsVisible, setOptionsVisible] = useState(false);
  const listRef = useRef<FlatList>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(SYNQ_TAB_LONG_PRESS, () => {
      setOptionsVisible(true);
    });
    return () => subscription.remove();
  }, []);

  useFocusEffect(
    useCallback(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    }, [])
  );

  const { friends: sortedAvailableFriends, distancesKm } = useSortedFriendsList(
    availableFriends as Friend[],
    "distance",
    userProfile
  );

  const freeCount = sortedAvailableFriends.length;
  const showSeeWhoElseNudge =
    !friendsLoading && freeCount === 1 && nudgeCandidates.length > 0;
  const selectedCount = selectedFriends.length;
  const showCta = selectedCount > 0;
  const showDock = !friendsLoading && freeCount > 0;
  const isShortList = freeCount > 0 && freeCount <= SHORT_LIST_MAX;
  const memoText = memo.trim();
  const sharingLabel = audienceLabel?.trim() || "All friends";

  const footerLayout = useMemo(() => {
    const ctaPadTop = 10;
    const ctaBottomPad =
      TAB_BAR_SCROLL_INSET +
      (isShortList ? ACTIVE_CTA_BOTTOM_NUDGE_SHORT : ACTIVE_CTA_BOTTOM_NUDGE);
    const dockHeight = ctaPadTop + ACTIVE_CTA_HEIGHT + ctaBottomPad;
    return {
      ctaPadTop,
      ctaBottomPad,
      dockHeight,
      listBottomPad: dockHeight + ACTIVE_LIST_BOTTOM_FADE_HEIGHT,
    };
  }, [isShortList]);

  const toggleFriend = (friendId: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedFriends((prev) =>
      prev.includes(friendId)
        ? prev.filter((id) => id !== friendId)
        : [...prev, friendId]
    );
  };

  return (
    <View style={parentStyles.activeSynqRoot}>
      <View style={[styles.body, { paddingTop: insets.top + 8 }]}>
        <View style={styles.statusPanel}>
          <Animated.View
            entering={reducedMotion ? undefined : FadeIn.duration(380)}
          >
            <View style={styles.headerRow}>
              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setOptionsVisible(true);
                }}
                style={({ pressed }) => [
                  styles.statusRowLead,
                  pressed && styles.statusRowPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Synq is active"
                accessibilityHint="Opens options to end Synq"
              >
                <ActiveLiveDot />
                <Text style={styles.activeTitle} numberOfLines={1}>
                  SYNQ IS ACTIVE
                </Text>
              </Pressable>
              <View style={styles.headerActions}>
                <TouchableOpacity
                  onPress={openMessagesInbox}
                  hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                  style={styles.headerIconBtn}
                  accessibilityRole="button"
                  accessibilityLabel={
                    unreadCount > 0
                      ? `Open messages, ${unreadCount} unread`
                      : "Open messages"
                  }
                >
                  <View style={styles.headerMsgIconWrap}>
                    <Ionicons name="chatbubble-outline" size={22} color={TEXT} />
                    {unreadCount > 0 ? (
                      <NotificationBadge
                        variant="count"
                        count={unreadCount}
                        tone="accent"
                      />
                    ) : null}
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setOptionsVisible(true)}
                  hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                  style={styles.headerIconBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Synq options"
                >
                  <Ionicons name="ellipsis-horizontal" size={22} color={TEXT} />
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>

          <Animated.View
            entering={
              reducedMotion ? undefined : FadeIn.delay(60).duration(400)
            }
          >
            <Pressable
              onPress={openEditModal}
              style={({ pressed }) => [
                styles.statusRow,
                pressed && styles.statusRowPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={
                memoText ? `Status: ${memoText}` : "Add a status"
              }
              accessibilityHint="Edit your status"
            >
              <Text
                style={[
                  styles.statusMemo,
                  !memoText && styles.statusMemoPlaceholder,
                ]}
                numberOfLines={2}
              >
                {memoText || MEMO_PLACEHOLDER}
              </Text>
              <Ionicons
                name="create-outline"
                size={18}
                color={MUTED2}
                style={styles.statusRowIcon}
              />
            </Pressable>
          </Animated.View>

          {audienceLabel || openChangeAudience ? (
            <>
              <View style={styles.statusDivider} />
              <Animated.View
                entering={
                  reducedMotion ? undefined : FadeIn.delay(110).duration(400)
                }
              >
                <Pressable
                  onPress={openChangeAudience}
                  disabled={!openChangeAudience}
                  style={({ pressed }) => [
                    styles.statusRow,
                    openChangeAudience && pressed && styles.statusRowPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Sharing with ${sharingLabel}`}
                  accessibilityHint={
                    openChangeAudience ? "Change who you're sharing with" : undefined
                  }
                >
                  <Text style={styles.sharingText} numberOfLines={1}>
                    Sharing with{" "}
                    <Text style={styles.sharingAccent}>{sharingLabel}</Text>
                  </Text>
                  <Ionicons
                    name="people"
                    size={18}
                    color={MUTED2}
                    style={styles.statusRowIcon}
                  />
                </Pressable>
              </Animated.View>
            </>
          ) : null}
        </View>

        <View style={styles.listPad}>
          <FlatList
            ref={listRef}
            style={styles.friendsList}
            data={friendsLoading ? [] : sortedAvailableFriends}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              friendsLoading ? (
                <ActiveFriendsSkeleton />
              ) : viewerId ? (
                <ActiveSynqEmptyState
                  viewerId={viewerId}
                  candidates={nudgeCandidates}
                />
              ) : null
            }
            ListFooterComponent={
              showSeeWhoElseNudge && viewerId ? (
                <ActiveSynqEmptyState
                  viewerId={viewerId}
                  candidates={nudgeCandidates}
                  variant="seeWhoElse"
                />
              ) : null
            }
            renderItem={({ item }) => {
              const friendMemo = item.memo?.trim();
              const locationLine = friendLocationWithDistance(
                friendLocationLine(item),
                distancesKm[item.id]
              );
              const selected = selectedFriends.includes(item.id);
              return (
                <TouchableOpacity
                  onPress={() => toggleFriend(item.id)}
                  style={[
                    styles.friendCard,
                    selected && styles.friendCardSelected,
                  ]}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={item.displayName}
                >
                  <View style={styles.friendAvatarWrap}>
                    <ExpoImage
                      source={{ uri: resolveAvatar(item.imageurl) }}
                      style={styles.friendAvatar}
                      cachePolicy="memory-disk"
                      transition={0}
                    />
                    <View style={styles.friendAvailDot} />
                  </View>
                  <View style={styles.friendCopy}>
                    <Text style={styles.friendName} numberOfLines={1}>
                      {item.displayName}
                    </Text>
                    {friendMemo ? (
                      <Text style={styles.friendMemo} numberOfLines={1}>
                        {friendMemo}
                      </Text>
                    ) : null}
                    {locationLine ? (
                      <View style={styles.friendMetaRow}>
                        <Ionicons
                          name="location-outline"
                          size={12}
                          color={MUTED2}
                          style={styles.friendMetaIcon}
                        />
                        <Text style={styles.friendMeta} numberOfLines={1}>
                          {locationLine}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            }}
            contentContainerStyle={[
              styles.listContent,
              {
                paddingTop: 10,
                paddingBottom: showDock
                  ? footerLayout.listBottomPad
                  : TAB_BAR_SCROLL_INSET,
                flexGrow: freeCount === 0 ? 1 : undefined,
              },
            ]}
          />
        </View>

        {showDock ? (
          <>
            <LinearGradient
              pointerEvents="none"
              colors={[
                BG_TRANSPARENT,
                "rgba(9,10,11,0.06)",
                "rgba(9,10,11,0.18)",
                "rgba(9,10,11,0.42)",
                "rgba(9,10,11,0.72)",
                BG,
              ]}
              locations={[0, 0.2, 0.4, 0.62, 0.82, 1]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={[
                parentStyles.activeListBottomFade,
                {
                  height: ACTIVE_LIST_BOTTOM_FADE_HEIGHT,
                  bottom: footerLayout.dockHeight,
                },
              ]}
            />
            <View
              style={[
                parentStyles.activeFooterDock,
                {
                  height: footerLayout.dockHeight,
                  paddingTop: footerLayout.ctaPadTop,
                  paddingBottom: footerLayout.ctaBottomPad,
                },
              ]}
            >
              <TouchableOpacity
                style={[
                  synqOutlineAddBtn,
                  parentStyles.activeStartChatBtn,
                  !showCta && synqOutlineAddBtnDisabled,
                  isConnecting && { opacity: 0.5 },
                ]}
                onPress={handleConnect}
                disabled={!showCta || isConnecting}
                activeOpacity={showCta ? 0.85 : 1}
                accessibilityRole="button"
                accessibilityLabel={
                  isConnecting
                    ? "Opening chat"
                    : !showCta
                      ? "Select friends who are free to chat"
                      : `Start chat with ${selectedCount} friend${
                          selectedCount === 1 ? "" : "s"
                        }`
                }
              >
                {isConnecting ? (
                  <ActivityIndicator color={ACCENT} />
                ) : (
                  <Text
                    style={[
                      synqOutlineAddBtnText,
                      !showCta && synqOutlineAddBtnTextDisabled,
                    ]}
                  >
                    {showCta ? "Start chat" : "Select friends"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        ) : null}
      </View>

      <SynqOptionsSheet
        visible={optionsVisible}
        onClose={() => setOptionsVisible(false)}
        onEndSynq={endSynq}
      />
    </View>
  );
}

function ActiveFriendsSkeleton() {
  return (
    <View accessibilityLabel="Loading friends">
      {Array.from({ length: 4 }).map((_, i) => (
        <View key={i} style={styles.friendCard}>
          <SkeletonBlock style={styles.friendAvatar} />
          <View style={styles.friendCopy}>
            <SkeletonBlock style={styles.friendSkeletonTitle} />
            <SkeletonBlock style={styles.friendSkeletonMeta} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    minHeight: 0,
    zIndex: 1,
  },
  statusPanel: {
    position: "relative",
    paddingHorizontal: 22,
    paddingBottom: 6,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    gap: 12,
  },
  statusRowPressed: {
    opacity: 0.72,
  },
  statusRowLead: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    gap: 8,
    minWidth: 0,
  },
  activeTitle: {
    color: ACCENT,
    fontFamily: fonts.heavy,
    fontSize: TYPE_BUTTON,
    lineHeight: 22,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  headerIconBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerMsgIconWrap: {
    position: "relative",
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statusDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: STATUS_DIVIDER,
  },
  statusMemo: {
    flex: 1,
    color: TEXT,
    fontFamily: fonts.book,
    fontSize: TYPE_BODY,
    lineHeight: 22,
  },
  statusMemoPlaceholder: {
    color: MUTED3,
  },
  statusRowIcon: {
    flexShrink: 0,
  },
  sharingText: {
    flex: 1,
    color: MUTED,
    fontFamily: fonts.book,
    fontSize: TYPE_BUTTON,
    lineHeight: 21,
  },
  sharingAccent: {
    color: ACCENT,
    fontFamily: fonts.medium,
  },
  listPad: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 22,
  },
  friendsList: {
    flex: 1,
    backgroundColor: "transparent",
  },
  listContent: {
    paddingHorizontal: 0,
    backgroundColor: "transparent",
  },
  friendCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 16,
    marginBottom: 10,
    borderRadius: RADIUS_MD,
    borderWidth: FRIEND_CARD_BORDER_WIDTH,
    borderColor: BORDER,
    backgroundColor: SURFACE_INPUT,
    overflow: "hidden",
  },
  friendCardSelected: {
    borderColor: ACCENT_BORDER,
    backgroundColor: SURFACE_INPUT,
  },
  friendAvatarWrap: {
    width: 52,
    height: 52,
    position: "relative",
  },
  friendAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  friendAvailDot: {
    position: "absolute",
    right: 0,
    bottom: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: ACCENT,
    borderWidth: 2,
    borderColor: BG,
  },
  friendCopy: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    paddingRight: 8,
  },
  friendName: {
    ...listRowTitleText,
  },
  friendMemo: {
    marginTop: 3,
    color: MUTED,
    fontSize: TYPE_CAPTION,
    lineHeight: 18,
    fontFamily: fonts.book,
  },
  friendMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  friendMetaIcon: {
    marginRight: 4,
  },
  friendMeta: {
    flex: 1,
    color: MUTED2,
    fontSize: TYPE_MICRO,
    fontFamily: fonts.book,
    letterSpacing: 0.2,
  },
  friendSkeletonTitle: {
    width: "52%",
    height: 14,
    borderRadius: 7,
  },
  friendSkeletonMeta: {
    width: "36%",
    height: 10,
    borderRadius: 5,
    marginTop: 8,
  },
});
