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
import SynqOptionsSheet from "../../../app/synq-screens/SynqOptionsSheet";
import {
  ACCENT,
  BG,
  BG_FADE_MID,
  BG_TRANSPARENT,
  MUTED2,
  TAB_BAR_SCROLL_INSET,
} from "../../../constants/Variables";

/** Matches audience lead icon on the active Synq screen. */
const ACTIVE_LEAD_ICON_SIZE = 20;
/** Fade strip sitting just above the Start chat dock. */
const ACTIVE_LIST_BOTTOM_FADE_HEIGHT = 52;
/** Extra lift for the Start chat CTA above the tab bar. */
const ACTIVE_CTA_BOTTOM_NUDGE = 48;
const ACTIVE_CTA_HEIGHT = 52;

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

  const sortedAvailableFriends = useSortedFriendsList(
    availableFriends as Friend[],
    sortMode,
    userProfile
  );

  const selectedCount = selectedFriends.length;
  const showCta = selectedCount > 0;

  const footerLayout = useMemo(() => {
    const ctaPadTop = 10;
    const ctaBottomPad = TAB_BAR_SCROLL_INSET + ACTIVE_CTA_BOTTOM_NUDGE;
    const dockHeight = ctaPadTop + ACTIVE_CTA_HEIGHT + ctaBottomPad;
    return {
      ctaPadTop,
      ctaBottomPad,
      dockHeight,
      listBottomPad: dockHeight + ACTIVE_LIST_BOTTOM_FADE_HEIGHT,
    };
  }, []);

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
          <Text style={styles.headerTitle} numberOfLines={1}>
            Synq is active
          </Text>
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
          { paddingTop: headerLayout.iconRowBottom + 14 },
        ]}
      >
        <View style={styles.headerDivider} />

        <View style={styles.activeListFooterDock}>
          {audienceLabel ? (
            <Pressable
              onPress={openChangeAudience}
              disabled={!openChangeAudience}
              style={({ pressed }) => [
                styles.audienceRow,
                openChangeAudience && pressed && styles.audienceRowPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Shared with ${audienceLabel}`}
              accessibilityHint={
                openChangeAudience ? "Opens sharing with" : undefined
              }
            >
              <Ionicons
                name="people-outline"
                size={ACTIVE_LEAD_ICON_SIZE}
                color={ACCENT}
                style={styles.activeSynqLeadIcon}
              />
              <Text style={styles.audienceText} numberOfLines={1}>
                Shared with {audienceLabel}
              </Text>
              {openChangeAudience ? (
                <Ionicons name="chevron-forward" size={14} color={MUTED2} />
              ) : null}
            </Pressable>
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
            renderItem={({ item }) => {
              const friendMemo = item.memo?.trim();
              const locationLine = friendLocationLine(item);
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
                      <Text style={styles.activeFriendMemo} numberOfLines={2}>
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
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            }}
            contentContainerStyle={[
              styles.activeListContent,
              {
                paddingTop: audienceLabel ? 6 : 8,
                paddingBottom:
                  availableFriends.length > 0
                    ? footerLayout.listBottomPad
                    : TAB_BAR_SCROLL_INSET,
              },
            ]}
          />

          {availableFriends.length > 0 ? (
            <>
              <LinearGradient
                pointerEvents="none"
                colors={[BG_TRANSPARENT, BG_FADE_MID, BG]}
                locations={[0, 0.55, 1]}
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
                <TouchableOpacity
                  style={[
                    styles.activeStartChatBtn,
                    !showCta && styles.activeStartChatBtnIdle,
                    isConnecting && { opacity: 0.5 },
                  ]}
                  onPress={handleConnect}
                  disabled={!showCta || isConnecting}
                  activeOpacity={showCta ? 0.88 : 1}
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
                        styles.activeStartChatLabel,
                        !showCta && styles.activeStartChatLabelIdle,
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
