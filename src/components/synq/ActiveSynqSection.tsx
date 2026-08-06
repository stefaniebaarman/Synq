import type { Friend } from "@/constants/Variables";
import {
  FriendsSortMenu,
  type FriendsSortMode,
} from "@/src/components/friends/FriendsSortControls";
import HeaderIconButton from "@/src/components/HeaderIconButton";
import NotificationBadge from "@/src/components/NotificationBadge";
import { useTabHeaderLayout } from "@/src/components/ProfileTabHeaderOverlay";
import ActiveSynqEmptyState from "@/src/components/synq/ActiveSynqEmptyState";
import TabHeaderIconRow from "@/src/components/TabHeaderIconRow";
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
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import SynqOptionsSheet from "../../../app/synq-screens/SynqOptionsSheet";
import {
  ACCENT,
  ACCENT_FILL_MUTED,
  BG,
  BG_TRANSPARENT,
  MUTED2,
  synqOutlineAddBtn,
  synqOutlineAddBtnText,
  TAB_BAR_SCROLL_INSET,
} from "../../../constants/Variables";

/** Fade strip sitting just above the Start chat dock. */
const ACTIVE_LIST_BOTTOM_FADE_HEIGHT = 72;
/** Extra lift for the Start chat CTA above the tab bar. */
const ACTIVE_CTA_BOTTOM_NUDGE = 64;
/** Approximate height of {@link synqOutlineAddBtn} (padding + label). */
const ACTIVE_CTA_HEIGHT = 48;
const LIVE_PULSE_SIZE = 8;
/** Tighter dock when few friends so the CTA doesn't float in empty space. */
const SHORT_LIST_MAX = 3;
const ACTIVE_CTA_BOTTOM_NUDGE_SHORT = 44;

function ActiveLivePulse({ reduced }: { reduced: boolean }) {
  const coreOpacity = useSharedValue(1);
  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0.45);

  useEffect(() => {
    if (reduced) {
      coreOpacity.value = 1;
      ringScale.value = 1;
      ringOpacity.value = 0;
      return;
    }
    coreOpacity.value = withRepeat(withTiming(0.4, { duration: 1100 }), -1, true);
    ringScale.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 0 }),
        withTiming(2.2, { duration: 1600 })
      ),
      -1,
      false
    );
    ringOpacity.value = withRepeat(
      withSequence(
        withTiming(0.5, { duration: 0 }),
        withTiming(0, { duration: 1600 })
      ),
      -1,
      false
    );
  }, [reduced, coreOpacity, ringScale, ringOpacity]);

  const coreStyle = useAnimatedStyle(() => ({
    opacity: coreOpacity.value,
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }));

  return (
    <View style={pulseStyles.wrap} accessibilityElementsHidden>
      <Animated.View style={[pulseStyles.ring, ringStyle]} />
      <Animated.View style={[pulseStyles.core, coreStyle]} />
    </View>
  );
}

const pulseStyles = {
  wrap: {
    width: LIVE_PULSE_SIZE + 10,
    height: LIVE_PULSE_SIZE + 10,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  core: {
    width: LIVE_PULSE_SIZE,
    height: LIVE_PULSE_SIZE,
    borderRadius: LIVE_PULSE_SIZE / 2,
    backgroundColor: ACCENT,
  },
  ring: {
    position: "absolute" as const,
    width: LIVE_PULSE_SIZE,
    height: LIVE_PULSE_SIZE,
    borderRadius: LIVE_PULSE_SIZE / 2,
    backgroundColor: ACCENT_FILL_MUTED,
    borderWidth: 1,
    borderColor: ACCENT,
  },
};

type Props = {
  styles: any;
  unreadCount: number;
  availableFriends: any[];
  selectedFriends: string[];
  setSelectedFriends: React.Dispatch<React.SetStateAction<string[]>>;
  handleConnect: () => void;
  isConnecting?: boolean;
  endSynq: () => void;
  insetsBottom: number;
  openMessagesInbox: () => void;
  openEditModal: () => void;
  openChangeAudience?: () => void;
  audienceLabel?: string | null;
  userProfile?: Record<string, unknown> | null;
  viewerId?: string;
  nudgeCandidates?: Friend[];
};

export default function ActiveSynqSection({
  styles,
  unreadCount,
  availableFriends,
  selectedFriends,
  setSelectedFriends,
  handleConnect,
  isConnecting = false,
  endSynq,
  insetsBottom,
  openMessagesInbox,
  openEditModal,
  openChangeAudience,
  audienceLabel,
  userProfile,
  viewerId,
  nudgeCandidates = [],
}: Props) {
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [sortMode, setSortMode] = useState<FriendsSortMode>("distance");
  const [sortMenuVisible, setSortMenuVisible] = useState(false);
  const headerLayout = useTabHeaderLayout();
  const listRef = useRef<FlatList>(null);
  const reducedMotion = useReducedMotion();
  const audienceIconOpacity = useSharedValue(1);

  useEffect(() => {
    if (reducedMotion) {
      audienceIconOpacity.value = 1;
      return;
    }
    audienceIconOpacity.value = withRepeat(
      withTiming(0.55, { duration: 1400 }),
      -1,
      true
    );
  }, [reducedMotion, audienceIconOpacity]);

  const audienceIconStyle = useAnimatedStyle(() => ({
    opacity: audienceIconOpacity.value,
  }));

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
    sortMode,
    userProfile
  );

  const selectedCount = selectedFriends.length;
  const showCta = selectedCount > 0;
  const freeCount = sortedAvailableFriends.length;
  /** Reserve dock + elevated fade whenever anyone is free. */
  const showDock = freeCount > 0;
  const isShortList = freeCount > 0 && freeCount <= SHORT_LIST_MAX;

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

  const renderStartChatButton = () => (
    <TouchableOpacity
      style={[
        synqOutlineAddBtn,
        styles.activeStartChatBtn,
        !showCta && styles.activeStartChatBtnIdle,
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
            !showCta && styles.activeStartChatLabelIdle,
          ]}
        >
          {showCta ? "Start chat" : "Select friends"}
        </Text>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.activeSynqRoot}>
      <TabHeaderIconRow>
        <View style={styles.synqHeaderSide}>
          <HeaderIconButton
            name="chatbubbles-outline"
            onPress={openMessagesInbox}
            accessibilityLabel={
              unreadCount > 0
                ? `Open messages, ${unreadCount} unread`
                : "Open messages"
            }
            badge={
              unreadCount > 0 ? (
                <NotificationBadge variant="count" count={unreadCount} tone="accent" />
              ) : undefined
            }
          />
        </View>
        <View style={styles.synqHeaderTitleCenter}>
          <Animated.View
            entering={reducedMotion ? undefined : FadeIn.duration(380)}
            style={styles.activeTitleRow}
          >
            <ActiveLivePulse reduced={!!reducedMotion} />
            <Text style={styles.headerTitle} numberOfLines={1}>
              Synq is active
            </Text>
          </Animated.View>
        </View>
        <View style={styles.synqHeaderSide}>
          <HeaderIconButton
            name="ellipsis-horizontal"
            onPress={() => setOptionsVisible(true)}
            accessibilityLabel="Synq options"
          />
        </View>
      </TabHeaderIconRow>
      <View
        style={[
          styles.activeBody,
          { paddingTop: headerLayout.iconRowBottom + 18, zIndex: 1 },
        ]}
      >
        <View style={styles.activeContentPad}>
          {audienceLabel ? (
            <Animated.View
              entering={
                reducedMotion ? undefined : FadeIn.delay(80).duration(420)
              }
              style={styles.activeAudienceBlock}
            >
              <Text style={styles.activeAudienceEyebrow}>Visible to</Text>
              <Pressable
                onPress={openChangeAudience}
                disabled={!openChangeAudience}
                style={({ pressed }) => [
                  styles.audienceRow,
                  openChangeAudience && pressed && styles.audienceRowPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Visible to ${audienceLabel}`}
                accessibilityHint={
                  openChangeAudience ? "Change who can see you" : undefined
                }
              >
                <Animated.View style={audienceIconStyle}>
                  <Ionicons
                    name="people-outline"
                    size={20}
                    color={ACCENT}
                    style={styles.activeSynqLeadIcon}
                  />
                </Animated.View>
                <Text style={styles.audienceValue} numberOfLines={1}>
                  {audienceLabel}
                </Text>
                {openChangeAudience ? (
                  <Ionicons
                    name="chevron-down"
                    size={16}
                    color={MUTED2}
                    style={styles.audienceChevron}
                  />
                ) : null}
              </Pressable>
            </Animated.View>
          ) : null}

          {freeCount > 0 ? (
            <Text style={styles.activeFriendsEyebrow}>Available now</Text>
          ) : null}

          <FlatList
            ref={listRef}
            style={styles.activeFriendsList}
            data={sortedAvailableFriends}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={null}
            ListEmptyComponent={
              viewerId ? (
                <ActiveSynqEmptyState viewerId={viewerId} candidates={nudgeCandidates} />
              ) : null
            }
            ListHeaderComponent={null}
            ListFooterComponent={null}
            renderItem={({ item }) => {
              const friendMemo = item.memo?.trim();
              const locationLine = friendLocationWithDistance(
                friendLocationLine(item),
                distancesKm[item.id]
              );
              const selected = selectedFriends.includes(item.id);
              return (
                <TouchableOpacity
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedFriends((prev) =>
                      prev.includes(item.id)
                        ? prev.filter((id) => id !== item.id)
                        : [...prev, item.id]
                    );
                  }}
                  style={[
                    styles.activeFriendTile,
                    selected && styles.activeFriendTileSelected,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={item.displayName}
                >
                  <View
                    style={[
                      styles.activeFriendAvatarRing,
                      selected && styles.activeFriendAvatarRingSelected,
                    ]}
                  >
                    <ExpoImage
                      source={{ uri: resolveAvatar(item.imageurl) }}
                      style={styles.activeFriendAvatar}
                      cachePolicy="memory-disk"
                      transition={0}
                    />
                  </View>

                  <View style={styles.activeFriendCopy}>
                    <Text style={styles.activeFriendName} numberOfLines={1}>
                      {item.displayName}
                    </Text>
                    {friendMemo ? (
                      <Text style={styles.activeFriendMemo} numberOfLines={1}>
                        {friendMemo}
                      </Text>
                    ) : null}
                    {locationLine ? (
                      <View style={styles.activeFriendMetaRow}>
                        <Ionicons
                          name="location-outline"
                          size={12}
                          color={MUTED2}
                          style={styles.activeFriendMetaIcon}
                        />
                        <Text style={styles.activeFriendMeta} numberOfLines={1}>
                          {locationLine}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.activeFriendSelectSlot}>
                    {selected ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={24}
                        color={ACCENT}
                      />
                    ) : (
                      <View style={styles.activeFriendSelectIdle} />
                    )}
                  </View>
                </TouchableOpacity>
              );
            }}
            contentContainerStyle={[
              styles.activeListContent,
              {
                paddingTop: 4,
                paddingBottom: showDock
                  ? footerLayout.listBottomPad
                  : TAB_BAR_SCROLL_INSET,
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
                  styles.activeListBottomFade,
                  {
                    height: ACTIVE_LIST_BOTTOM_FADE_HEIGHT,
                    bottom: footerLayout.dockHeight,
                  },
                ]}
              />
              <View
                style={[
                  styles.activeFooterDock,
                  {
                    height: footerLayout.dockHeight,
                    paddingTop: footerLayout.ctaPadTop,
                    paddingBottom: footerLayout.ctaBottomPad,
                  },
                ]}
              >
                {renderStartChatButton()}
              </View>
            </>
          ) : null}
      </View>

      <FriendsSortMenu
        visible={sortMenuVisible}
        sortMode={sortMode}
        onSelect={setSortMode}
        onClose={() => setSortMenuVisible(false)}
      />

      <SynqOptionsSheet
        visible={optionsVisible}
        onClose={() => setOptionsVisible(false)}
        onEditMemo={openEditModal}
        onChangeAudience={openChangeAudience}
        onSortFriends={
          availableFriends.length > 0
            ? () => setSortMenuVisible(true)
            : undefined
        }
        onEndSynq={endSynq}
      />
    </View>
  );
}
