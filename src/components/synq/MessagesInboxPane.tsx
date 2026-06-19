import BackButton from "@/src/components/BackButton";
import CloseButton from "@/src/components/CloseButton";
import ChatInboxActionSheet from "@/src/components/synq/ChatInboxActionSheet";
import { MUTED2 } from "@/constants/Variables";
import { getCommunityChatInboxSubtitle } from "@/src/lib/helpers";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { FlatList, Text, TouchableOpacity, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  styles: any;
  allChats: any[];
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

export default function MessagesInboxPane({
  styles,
  allChats,
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
  const inboxHeaderPaddingTop = Math.max(insets.top, 20) + 6;
  const inboxMergeHeaderPaddingTop = Math.max(insets.top, 16) + 6;
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
            : getChatTitle(item)
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
                <Ionicons name="checkmark" size={15} color="white" />
              ) : null}
            </View>
          ) : null}
          <View style={styles.avatarColumn}>
            {renderAvatarStack(item.participantImages, item.participants)}
          </View>
          <View style={styles.inboxTextCol}>
            <View style={styles.inboxTitleRow}>
              <Text
                style={[
                  styles.whiteBold,
                  styles.inboxTitleText,
                  isUnreadThread && styles.unreadChatTitle,
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {getChatTitle(item)}
              </Text>
            </View>
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
                <Text style={styles.grayText} numberOfLines={1}>
                  {lm}
                </Text>
              );
            })()}
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
          <View style={styles.headerDivider} />
        </View>
      )}

      <FlatList
        data={allChats}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={styles.inboxEmptyWrap}>
            <View style={styles.inboxEmptyIconWrap}>
              <Ionicons name="chatbubbles-outline" size={28} color={MUTED2} />
            </View>
            <Text style={styles.inboxEmptyTitle}>No messages yet</Text>
            <Text style={styles.inboxEmptySub}>
              Start a plan with a friend and your conversations will show up here.
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => (
          <View style={styles.inboxSeparatorBetween}>
            <View style={styles.inboxSeparatorLine} />
          </View>
        )}
        contentContainerStyle={[
          styles.inboxListContent,
          mergeSelectMode && styles.inboxListContentMerge,
        ]}
        renderItem={({ item, index }) => renderChatRow(item, index)}
      />

      {mergeSelectMode ? (
        <View style={styles.inboxMergeFooterCard}>
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
              styles.inboxMergePrimaryBtn,
              (!mergeReady || mergeBusy) && styles.inboxMergePrimaryBtnDisabled,
            ]}
            onPress={onConfirmMerge}
            disabled={!mergeReady || mergeBusy}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="Create group chat"
          >
            <Text
              style={[
                styles.inboxMergePrimaryBtnText,
                (!mergeReady || mergeBusy) && styles.inboxMergePrimaryBtnTextDisabled,
              ]}
            >
              {mergeBusy ? "Creating…" : "Create group chat"}
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
