import AlertModal from "@/app/alert-modal";
import ConfirmModal from "@/app/confirm-modal";
import {
  ACCENT,
  BORDER,
  DESTRUCTIVE,
  GROUP_BORDER,
  MUTED,
  MUTED2,
  RADIUS_MD,
  SPACE_2,
  SPACE_3,
  SPACE_4,
  SPACE_5,
  SURFACE_RAISED,
  SYNQ_OUTLINE_CTA_RADIUS,
  TEXT,
  TYPE_BODY,
  TYPE_CAPTION,
  TYPE_LEAD,
  cardMetaText,
  fonts,
  listRowTitleText,
  listSectionTitle,
  sectionLinkText,
  synqOutlineAddBtnCompact,
  synqOutlineAddBtnTextCompact,
} from "@/constants/Variables";
import CreateCommunityPostModal from "@/src/components/community/CreateCommunityPostModal";
import SynqPlusAddButton from "@/src/components/SynqPlusAddButton";
import {
  approveCommunityPost,
  createCommunityPost,
  deleteCommunityPost,
  mergeFeedPosts,
  rejectCommunityPost,
  subscribeApprovedCommunityPosts,
  subscribeOwnPendingCommunityPosts,
  subscribePendingCommunityPosts,
  type CommunityPost,
} from "@/src/lib/communityPosts";
import { filterOrReject } from "@/src/lib/contentFilter";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type Props = {
  groupId: string;
  groupName: string;
  uid: string;
  isMember: boolean;
  isCreator: boolean;
};

const FEED_PREVIEW_COUNT = 2;

function formatPostTime(createdAt: unknown): string {
  const ms =
    typeof (createdAt as { toMillis?: () => number } | undefined)?.toMillis === "function"
      ? (createdAt as { toMillis: () => number }).toMillis()
      : 0;
  if (!ms) return "";
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ms).toLocaleDateString();
}

export default function CommunityFeedSection({
  groupId,
  groupName,
  uid,
  isMember,
  isCreator,
}: Props) {
  const [approved, setApproved] = useState<CommunityPost[]>([]);
  const [pendingAdmin, setPendingAdmin] = useState<CommunityPost[]>([]);
  const [pendingOwn, setPendingOwn] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [showAllPosts, setShowAllPosts] = useState(false);
  const [reviewBusyId, setReviewBusyId] = useState<string | null>(null);
  const [pendingDeletePost, setPendingDeletePost] = useState<CommunityPost | null>(null);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");

  const showAlert = useCallback((title: string, message = "") => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  }, []);

  useEffect(() => {
    if (!groupId || !isMember) {
      setApproved([]);
      setPendingAdmin([]);
      setPendingOwn([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(false);
    let approvedReady = false;
    let pendingReady = false;
    let sawError = false;
    const maybeDone = () => {
      if (approvedReady && pendingReady) {
        setLoading(false);
        setLoadError(sawError);
      }
    };

    const unsubApproved = subscribeApprovedCommunityPosts(
      groupId,
      (next) => {
        setApproved(next);
        approvedReady = true;
        maybeDone();
      },
      () => {
        sawError = true;
        approvedReady = true;
        maybeDone();
      }
    );

    let unsubPending: (() => void) | undefined;
    if (isCreator) {
      unsubPending = subscribePendingCommunityPosts(
        groupId,
        (next) => {
          setPendingAdmin(next);
          pendingReady = true;
          maybeDone();
        },
        () => {
          sawError = true;
          pendingReady = true;
          maybeDone();
        }
      );
    } else {
      unsubPending = subscribeOwnPendingCommunityPosts(
        groupId,
        uid,
        (next) => {
          setPendingOwn(next);
          pendingReady = true;
          maybeDone();
        },
        () => {
          sawError = true;
          pendingReady = true;
          maybeDone();
        }
      );
    }

    return () => {
      unsubApproved();
      unsubPending?.();
    };
  }, [groupId, isMember, isCreator, uid]);

  const pendingForAdmin = isCreator ? pendingAdmin : [];
  const ownPending = !isCreator ? pendingOwn : [];
  const feedPosts = useMemo(
    () => mergeFeedPosts(approved, ownPending),
    [approved, ownPending]
  );
  const displayedPosts = showAllPosts
    ? feedPosts
    : feedPosts.slice(0, FEED_PREVIEW_COUNT);
  const canToggleAll = feedPosts.length > FEED_PREVIEW_COUNT;

  const openCreate = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCreateVisible(true);
  };

  const handleCreate = async (input: { body: string; linkUrl: string }) => {
    if (!uid || createBusy) {
      throw new Error("Not ready to post yet.");
    }
    const bodyCheck = filterOrReject(input.body);
    if (!bodyCheck.ok) {
      throw new Error(bodyCheck.reason);
    }
    setCreateBusy(true);
    try {
      await createCommunityPost(groupId, uid, isCreator, input);
      setCreateVisible(false);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (!isCreator) {
        showAlert(
          "Submitted for approval",
          `An admin of ${groupName || "this community"} will review your post.`
        );
      }
    } catch (err: unknown) {
      // Re-throw so the modal can show the error above the form.
      throw err;
    } finally {
      setCreateBusy(false);
    }
  };

  const handleApprove = async (post: CommunityPost) => {
    if (!uid || reviewBusyId) return;
    setReviewBusyId(post.id);
    try {
      await approveCommunityPost(groupId, post.id, uid);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      showAlert(
        "Couldn't approve",
        err instanceof Error ? err.message : "Please try again."
      );
    } finally {
      setReviewBusyId(null);
    }
  };

  const handleReject = async (post: CommunityPost) => {
    if (!uid || reviewBusyId) return;
    setReviewBusyId(post.id);
    try {
      await rejectCommunityPost(groupId, post.id, uid);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      showAlert(
        "Couldn't reject",
        err instanceof Error ? err.message : "Please try again."
      );
    } finally {
      setReviewBusyId(null);
    }
  };

  const promptDeletePost = (post: CommunityPost) => {
    if (!uid || reviewBusyId) return;
    if (!(isCreator || post.authorId === uid)) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPendingDeletePost(post);
  };

  const handleConfirmDelete = async () => {
    const post = pendingDeletePost;
    if (!uid || !post || reviewBusyId) return;
    setReviewBusyId(post.id);
    try {
      await deleteCommunityPost(groupId, post.id);
      setPendingDeletePost(null);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      showAlert(
        "Couldn't delete",
        err instanceof Error ? err.message : "Please try again."
      );
    } finally {
      setReviewBusyId(null);
    }
  };

  const openLink = (url: string) => {
    void Linking.openURL(url).catch(() => {
      showAlert("Couldn't open link", "Check the URL and try again.");
    });
  };

  if (!isMember) {
    return (
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Feed</Text>
        </View>
        <Text style={styles.empty}>Join to see posts and share updates.</Text>
      </View>
    );
  }

  const renderPostCard = (post: CommunityPost, options?: { pendingReview?: boolean }) => {
    const busy = reviewBusyId === post.id;
    const timeLabel = formatPostTime(post.createdAt);
    return (
      <View key={post.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderText}>
            <Text style={styles.authorName} numberOfLines={1}>
              {post.authorDisplayName}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {post.status === "pending"
                ? options?.pendingReview
                  ? "Needs approval"
                  : "Awaiting approval"
                : timeLabel || "Posted"}
            </Text>
          </View>
          {(isCreator || post.authorId === uid) ? (
            <TouchableOpacity
              onPress={() => promptDeletePost(post)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={
                post.authorId === uid ? "Delete post" : "Delete member post"
              }
            >
              <Ionicons name="trash-outline" size={18} color={MUTED2} />
            </TouchableOpacity>
          ) : null}
        </View>
        <Text style={styles.body}>{post.body}</Text>
        {post.linkUrl ? (
          <TouchableOpacity
            onPress={() => openLink(post.linkUrl!)}
            style={styles.linkRow}
            accessibilityRole="link"
            accessibilityLabel={`Open link ${post.linkUrl}`}
          >
            <Ionicons name="link-outline" size={16} color={ACCENT} />
            <Text style={styles.linkText} numberOfLines={1}>
              {post.linkUrl}
            </Text>
          </TouchableOpacity>
        ) : null}
        {options?.pendingReview ? (
          <View style={styles.reviewRow}>
            <TouchableOpacity
              style={[synqOutlineAddBtnCompact, busy && styles.disabled]}
              disabled={busy}
              onPress={() => void handleApprove(post)}
            >
              <Text style={synqOutlineAddBtnTextCompact}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.rejectBtn, busy && styles.disabled]}
              disabled={busy}
              onPress={() => void handleReject(post)}
            >
              <Text style={styles.rejectText}>Reject</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <>
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Feed</Text>
          <View style={styles.sectionHeaderActions}>
            {canToggleAll ? (
              <TouchableOpacity
                onPress={() => setShowAllPosts((prev) => !prev)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.sectionHeaderAction}
                accessibilityRole="button"
                accessibilityLabel={showAllPosts ? "Show fewer posts" : "Show all posts"}
              >
                <Text style={styles.sectionLink}>
                  {showAllPosts ? "Show less" : "See all"}
                </Text>
              </TouchableOpacity>
            ) : null}
            <SynqPlusAddButton
              onPress={openCreate}
              label="Post"
              accessibilityLabel="Add post"
            />
          </View>
        </View>

        {pendingForAdmin.length > 0 ? (
          <View style={styles.pendingBlock}>
            <Text style={styles.pendingLabel}>
              Pending approval ({pendingForAdmin.length})
            </Text>
            {pendingForAdmin.map((post) => renderPostCard(post, { pendingReview: true }))}
          </View>
        ) : null}

        {loading ? (
          <Text style={styles.empty}>Loading posts…</Text>
        ) : loadError ? (
          <Text style={styles.empty}>
            Could not load posts. Check your connection and try again.
          </Text>
        ) : feedPosts.length === 0 && pendingForAdmin.length === 0 ? (
          <Text style={styles.empty}>
            No posts yet. Share an update or a link with the community.
          </Text>
        ) : (
          <View style={styles.list}>
            {displayedPosts.map((post) => renderPostCard(post))}
          </View>
        )}
      </View>

      <CreateCommunityPostModal
        visible={createVisible}
        busy={createBusy}
        isAdmin={isCreator}
        onClose={() => setCreateVisible(false)}
        onCreate={handleCreate}
      />

      <ConfirmModal
        visible={pendingDeletePost != null}
        title="Delete post?"
        message={
          pendingDeletePost
            ? pendingDeletePost.authorId === uid
              ? "Delete your post? This cannot be undone."
              : `Delete ${pendingDeletePost.authorDisplayName}'s post? This cannot be undone.`
            : ""
        }
        confirmText="Delete"
        destructive
        onCancel={() => setPendingDeletePost(null)}
        onConfirm={() => void handleConfirmDelete()}
      />

      <AlertModal
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        onClose={() => setAlertVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  sectionBlock: {
    paddingTop: SPACE_4,
    gap: SPACE_3,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACE_5,
  },
  sectionTitle: {
    ...listSectionTitle,
  },
  sectionHeaderAction: {
    paddingVertical: 4,
  },
  sectionHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE_4,
  },
  sectionLink: {
    ...sectionLinkText,
  },
  empty: {
    fontFamily: fonts.book,
    fontSize: TYPE_LEAD,
    color: MUTED2,
    paddingHorizontal: SPACE_5,
    paddingBottom: SPACE_4,
  },
  list: {
    gap: SPACE_3,
    paddingHorizontal: SPACE_5,
  },
  pendingBlock: {
    gap: SPACE_3,
    paddingHorizontal: SPACE_5,
  },
  pendingLabel: {
    fontFamily: fonts.medium,
    fontSize: TYPE_CAPTION,
    color: MUTED,
  },
  card: {
    borderRadius: RADIUS_MD,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GROUP_BORDER,
    backgroundColor: SURFACE_RAISED,
    padding: SPACE_3,
    gap: SPACE_2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE_2,
  },
  cardHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  authorName: {
    ...listRowTitleText,
    color: ACCENT,
    fontFamily: fonts.heavy,
  },
  meta: {
    ...cardMetaText,
    marginTop: 1,
  },
  body: {
    fontFamily: fonts.book,
    fontSize: TYPE_BODY,
    color: TEXT,
    lineHeight: 22,
    marginTop: 2,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 2,
  },
  linkText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: TYPE_CAPTION,
    color: ACCENT,
  },
  reviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE_2,
    paddingTop: SPACE_2,
  },
  rejectBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: SYNQ_OUTLINE_CTA_RADIUS,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  rejectText: {
    fontFamily: fonts.medium,
    fontSize: TYPE_CAPTION,
    color: DESTRUCTIVE,
  },
  disabled: {
    opacity: 0.5,
  },
});
