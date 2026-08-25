import BackButton from "@/src/components/BackButton";
import CloseButton from "@/src/components/CloseButton";
import { ListRowsSkeleton } from "@/src/components/loading/BrandSkeletons";
import ChatInboxActionSheet from "@/src/components/synq/ChatInboxActionSheet";
import {
  ACCENT,
  MUTED2,
  messagesModalHeaderPaddingTop,
  synqOutlineAddBtn,
  synqOutlineAddBtnDisabled,
  synqOutlineAddBtnText,
  synqOutlineAddBtnTextDisabled,
} from "@/constants/Variables";
import {
  formatInboxMessageTime,
  getCommunityChatInboxSubtitle,
} from "@/src/lib/helpers";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { initialWindowMetrics, useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  styles: any;
  allChats: any[];
  /** True after the first chats snapshot (avoids empty-state flash). */
  chatsHydrated?: boolean;
  currentUserId?: string;
  getChatTitle: (chat: any) => string;
  renderAvatarStack: (images: any, participants?: string[]) => React.ReactNode;
  onCloseMessages: () => void;
  onOpenChat: (chat: any) => Promise<void>;
  onPrepareChatPress?: (chatId: string) => void;
  onDeleteChat: (chatId: string) => void;
  onChatLongPress?: (chat: any) => void;
  renderDeleteConfirmModal: React.ReactNode;
  mergeSelectMode?: boolean;
  selectedMergeChatIds?: string[];
  mergePreviewTitle?: string;
  mergeAnchorTitle?: string;
  mergeReady?: boolean;
  mergeBusy?: boolean;
  onCancelMergeMode?: () => void;
  onToggleMergeChatSelection?: (chatId: string) => void;
  onConfirmMerge?: () => void;
  renderMergeConfirmModal?: React.ReactNode;
  inboxActionChat?: any | null;
  onCloseInboxAction?: () => void;
  onCombineChat?: (chatId: string) => void;
  onDeleteFromAction?: (chatId: string) => void;
};

function inboxTimestamp(item: any): string {
  const ts = item.updatedAt ?? item.createdAt;
  if (!ts) return "";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  if (Number.isNaN(date.getTime())) return "";
  return formatInboxMessageTime(date);
}

export default function MessagesInboxPane({
  styles,
  allChats,
  chatsHydrated = true,
  currentUserId,
  getChatTitle,
  renderAvatarStack,
  onCloseMessages,
  onOpenChat,
  onPrepareChatPress,
  onDeleteChat,
  onChatLongPress,
  renderDeleteConfirmModal,
  mergeSelectMode = false,
  selectedMergeChatIds = [],
  mergePreviewTitle = "",
  mergeAnchorTitle = "",
  mergeReady = false,
  mergeBusy = false,
  onCancelMergeMode,
  onToggleMergeChatSelection,
  onConfirmMerge,
  renderMergeConfirmModal,
  inboxActionChat = null,
  onCloseInboxAction,
  onCombineChat,
  onDeleteFromAction,
}: Props) {
  const insets = useSafeAreaInsets();
  const inboxHeaderPaddingTop = messagesModalHeaderPaddingTop(insets.top);
  const inboxMergeHeaderPaddingTop = Math.max(insets.top, 16) + 6;
  const inboxBottomInset = Math.max(
    insets.bottom,
    initialWindowMetrics?.insets.bottom ?? 0
  );
  const inboxBottomPad = inboxBottomInset + 8;
  const canCombine = allChats.length >= 2;

  const mergeSubtitle =
    selectedMergeChatIds.length === 1 && mergeAnchorTitle
      ? `Pick one more to combine with ${mergeAnchorTitle}`
      : !mergeReady
        ? "Pick two conversations"
        : "";

  const renderChatRow = (item: any, index: number) => {
    const updatedAtMs = item.updatedAt?.toMillis?.() ?? 0;
    const lastReadMs = currentUserId
      ? item.lastReadBy?.[currentUserId]?.toMillis?.() ?? 0
      : 0;
    const lastSender = item.lastMessageSenderId;
    const isUnreadThread =
      !!currentUserId &&
      !!lastSender &&
      lastSender !== currentUserId &&
      updatedAtMs > lastReadMs;
    const isSelected = selectedMergeChatIds.includes(item.id);
    const timeLabel = inboxTimestamp(item);

    const rowContent = (
      <TouchableOpacity
        style={[
          styles.inboxItem,
          index === 0 && styles.inboxItemFirst,
          isUnreadThread && !mergeSelectMode && styles.inboxItemUnread,
          mergeSelectMode && isSelected && styles.inboxItemSelected,
        ]}
        onPress={() => {
          if (mergeSelectMode) {
            onToggleMergeChatSelection?.(item.id);
            return;
          }
          void onOpenChat(item);
        }}
        onPressIn={() => {
          if (mergeSelectMode) return;
          onPrepareChatPress?.(item.id);
        }}
        onLongPress={() => {
          if (mergeSelectMode) return;
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onChatLongPress?.(item);
        }}
        delayLongPress={400}
        accessibilityRole="button"
        accessibilityState={{ selected: mergeSelectMode ? isSelected : undefined }}
        accessibilityLabel={
          mergeSelectMode
            ? `${getChatTitle(item)}${isSelected ? ", selected" : ""}`
            : `${getChatTitle(item)}${isUnreadThread ? ", unread" : ""}${
                timeLabel ? `, ${timeLabel}` : ""
              }`
        }
      >
        <View style={styles.inboxItemRow}>
          {mergeSelectMode ? (
            <View
              style={[
                styles.inboxSelectBadge,
                isSelected && styles.inboxSelectBadgeActive,
              ]}
            >
              {isSelected ? (
                <Ionicons name="checkmark" size={15} color={ACCENT} />
              ) : null}
            </View>
          ) : null}
          <View style={styles.avatarColumn}>
            {renderAvatarStack(item.participantImages, item.participants)}
          </View>
          <View style={styles.inboxTextCol}>
            <View style={styles.inboxMainRow}>
              <View style={styles.inboxCopyCol}>
                <Text
                  style={[
                    styles.inboxTitleText,
                    isUnreadThread ? styles.unreadChatTitle : styles.readChatTitle,
                  ]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {getChatTitle(item)}
                </Text>
                {(() => {
                  const subtitle = getCommunityChatInboxSubtitle(item);
                  if (!subtitle) return null;
                  return (
                    <Text style={styles.communityChatMeta} numberOfLines={1}>
                      {subtitle}
                    </Text>
                  );
                })()}
                {(() => {
                  const lm =
                    typeof item.lastMessage === "string"
                      ? item.lastMessage.trim()
                      : "";
                  if (!lm || lm === "Synq established!") return null;
                  return (
                    <Text
                      style={[
                        styles.grayText,
                        styles.inboxPreview,
                        isUnreadThread && styles.inboxPreviewUnread,
                      ]}
                      numberOfLines={2}
                    >
                      {lm}
                    </Text>
                  );
                })()}
              </View>
              {timeLabel ? (
                <Text
                  style={[
                    styles.inboxTime,
                    isUnreadThread && styles.inboxTimeUnread,
                  ]}
                  numberOfLines={1}
                >
                  {timeLabel}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );

    if (mergeSelectMode) {
      return rowContent;
    }

    return (
      <Swipeable
        rightThreshold={24}
        onSwipeableOpen={(direction) => {
          if (direction === "right") {
            onDeleteChat(item.id);
          }
        }}
        renderRightActions={() => (
          <TouchableOpacity
            style={styles.deleteAction}
            onPress={() => onDeleteChat(item.id)}
            accessibilityRole="button"
            accessibilityLabel="Delete conversation"
          >
            <Ionicons name="trash" size={24} color="white" />
          </TouchableOpacity>
        )}
      >
        {rowContent}
      </Swipeable>
    );
  };

  return (
    <View style={styles.modalBg}>
      {mergeSelectMode ? (
        <>
          <View style={[styles.inboxMergeHeader, { paddingTop: inboxMergeHeaderPaddingTop }]}>
            <BackButton
              onPress={onCancelMergeMode ?? (() => {})}
              style={styles.inboxMergeBackBtn}
              accessibilityLabel="Cancel combining chats"
            />
            <Text style={styles.inboxMergeHeaderTitle} numberOfLines={1}>
              Combine chats
            </Text>
            <View style={styles.inboxMergeHeaderSide} />
          </View>
          {mergeSubtitle ? (
            <Text style={styles.inboxMergeSubtitle}>{mergeSubtitle}</Text>
          ) : null}
        </>
      ) : (
        <View
          style={[styles.inboxHeaderBlock, { paddingTop: inboxHeaderPaddingTop }]}
        >
          <View style={styles.inboxHeaderRow}>
            <Text style={styles.messagesInboxTitle}>Messages</Text>
            <CloseButton
              onPress={onCloseMessages}
              accessibilityLabel="Close messages"
            />
          </View>
        </View>
      )}

      <FlatList
        data={allChats}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          !chatsHydrated ? (
            <View style={styles.inboxLoadingWrap}>
              <ListRowsSkeleton count={5} />
            </View>
          ) : (
            <View style={styles.inboxEmptyWrap}>
              <View style={styles.inboxEmptyIconWrap}>
                <Ionicons name="chatbubbles-outline" size={28} color={MUTED2} />
              </View>
              <Text style={styles.inboxEmptyTitle}>No messages yet</Text>
              <Text style={styles.inboxEmptySub}>
                Start a plan with a friend and your conversations will show up here.
              </Text>
            </View>
          )
        }
        ItemSeparatorComponent={() => (
          <View
            style={[
              styles.inboxSeparatorBetween,
              mergeSelectMode && styles.inboxSeparatorBetweenMerge,
            ]}
          >
            <View style={styles.inboxSeparatorLine} />
          </View>
        )}
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.inboxListContent,
          { paddingBottom: inboxBottomPad },
          mergeSelectMode && styles.inboxListContentMerge,
        ]}
        renderItem={({ item, index }) => renderChatRow(item, index)}
      />

      {mergeSelectMode ? (
        <View style={[styles.inboxMergeFooterCard, { marginBottom: Math.max(inboxBottomInset, 12) }]}>
          <Text style={styles.inboxMergeFooterLabel}>New group chat</Text>
          {mergeReady ? (
            <Text style={styles.inboxMergeFooterTitle} numberOfLines={2}>
              {mergePreviewTitle}
            </Text>
          ) : (
            <Text style={styles.inboxMergeFooterHint}>
              {selectedMergeChatIds.length === 1 && mergeAnchorTitle
                ? `Choose another conversation to combine with ${mergeAnchorTitle}.`
                : "Everyone from both conversations will be in one thread."}
            </Text>
          )}
          <TouchableOpacity
            style={[
              synqOutlineAddBtn,
              localStyles.mergePrimaryBtn,
              (!mergeReady || mergeBusy) && synqOutlineAddBtnDisabled,
            ]}
            onPress={onConfirmMerge}
            disabled={!mergeReady || mergeBusy}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="Create group chat"
          >
            <Text
              style={[
                synqOutlineAddBtnText,
                (!mergeReady || mergeBusy) && synqOutlineAddBtnTextDisabled,
                mergeBusy && { opacity: 0.5 },
              ]}
            >
              Create group chat
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <ChatInboxActionSheet
        visible={!!inboxActionChat}
        chatTitle={inboxActionChat ? getChatTitle(inboxActionChat) : ""}
        canCombine={canCombine}
        onClose={() => onCloseInboxAction?.()}
        onCombine={() => {
          if (inboxActionChat) onCombineChat?.(inboxActionChat.id);
        }}
        onDelete={() => {
          if (inboxActionChat) onDeleteFromAction?.(inboxActionChat.id);
        }}
      />

      {renderDeleteConfirmModal}
      {renderMergeConfirmModal}
    </View>
  );
}

const localStyles = StyleSheet.create({
  mergePrimaryBtn: {
    alignSelf: "stretch",
    width: "100%",
    paddingVertical: 15,
  },
});
