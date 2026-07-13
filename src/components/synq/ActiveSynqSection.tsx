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
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useState } from "react";
import {
  DeviceEventEmitter,
  FlatList,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import SynqOptionsSheet from "../../../app/synq-screens/SynqOptionsSheet";
import {
  ACCENT,
  BG,
  BG_FADE_MID,
  BG_TRANSPARENT,
  MUTED2,
  PRIMARY_CTA_HEIGHT,
  TAB_BAR_SCROLL_INSET,
  TEXT_MUTED_HEX,
} from "../../../constants/Variables";

/** Matches audience lead icon on the active Synq screen. */
const ACTIVE_LEAD_ICON_SIZE = 20;
/** Fade strip sitting just above the Select friends button. */
const ACTIVE_LIST_BOTTOM_FADE_HEIGHT = 52;
/** Extra lift for the Select friends CTA above the tab bar. */
const ACTIVE_CTA_BOTTOM_NUDGE = 48;

type Props = {
  styles: any;
  hasUnread: boolean;
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
  hasUnread,
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
  const pulseOpacity = useSharedValue(1);
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    const easing = Easing.inOut(Easing.ease);
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.62, { duration: 1200, easing }),
        withTiming(1, { duration: 1200, easing })
      ),
      -1,
      false
    );
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(0.94, { duration: 1200, easing }),
        withTiming(1, { duration: 1200, easing })
      ),
      -1,
      false
    );
    return () => {
      cancelAnimation(pulseOpacity);
      cancelAnimation(pulseScale);
      pulseOpacity.value = 1;
      pulseScale.value = 1;
    };
  }, [pulseOpacity, pulseScale]);

  const activeStatusDotStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
    transform: [{ scale: pulseScale.value }],
  }));

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(SYNQ_TAB_LONG_PRESS, () => {
      setOptionsVisible(true);
    });
    return () => subscription.remove();
  }, []);

  const sortedAvailableFriends = useSortedFriendsList(
    availableFriends as Friend[],
    sortMode,
    userProfile
  );

  const footerLayout = useMemo(() => {
    const ctaPadTop = 12;
    const ctaBottomPad = TAB_BAR_SCROLL_INSET + ACTIVE_CTA_BOTTOM_NUDGE;
    const ctaBlockHeight = ctaPadTop + PRIMARY_CTA_HEIGHT;
    const dockHeight = ctaBlockHeight + ctaBottomPad;
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
            accessibilityLabel="Open messages"
            badge={hasUnread ? <NotificationBadge variant="dot" /> : undefined}
          />
        </View>
        <View style={styles.synqHeaderTitleCenter}>
          <View style={styles.headerTitleWithIndicator}>
            <Animated.View
              style={[styles.activeStatusDot, activeStatusDotStyle]}
              accessibilityLabel="Synq session live"
            />
            <Text style={styles.headerTitle} numberOfLines={1}>
              Synq is active
            </Text>
          </View>
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
              openChangeAudience ? "Opens change audience" : undefined
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
                  styles.friendCard,
                  selected ? styles.friendCardSelected : styles.friendCardUnselected,
                ]}
              >
                <ExpoImage
                  source={{ uri: resolveAvatar(item.imageurl) }}
                  style={styles.friendImg}
                  cachePolicy="memory-disk"
                  transition={0}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.whiteBold}>{item.displayName}</Text>

                  {locationLine ? (
                    <View style={styles.locationRow}>
                      <Ionicons
                        name="location-outline"
                        size={14}
                        color={TEXT_MUTED_HEX}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={styles.locationText}>{locationLine}</Text>
                    </View>
                  ) : null}

                  {friendMemo ? (
                    <Text style={styles.friendMemoInline} numberOfLines={2}>
                      {friendMemo}
                    </Text>
                  ) : null}
                </View>

                {selected ? (
                  <Ionicons name="checkmark-circle" size={24} color={ACCENT} />
                ) : null}
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={[
            styles.activeListContent,
            {
              paddingTop: audienceLabel ? 4 : 8,
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
                  styles.btn,
                  (!selectedFriends.length || isConnecting) && { opacity: 0.5 },
                ]}
                onPress={handleConnect}
                disabled={!selectedFriends.length || isConnecting}
                accessibilityRole="button"
                accessibilityLabel={
                  isConnecting
                    ? "Starting chat"
                    : selectedFriends.length === 0
                    ? "Select friends who are free to chat"
                    : `Start chat with ${selectedFriends.length} friend${
                        selectedFriends.length === 1 ? "" : "s"
                      }`
                }
              >
                <Text style={styles.btnText}>
                  {isConnecting
                    ? "Starting..."
                    : selectedFriends.length === 0
                    ? "Select friends"
                    : "Start chat"}
                </Text>
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
