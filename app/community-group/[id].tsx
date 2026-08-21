import AlertModal from "@/app/alert-modal";
import ConfirmModal from "@/app/confirm-modal";
import { sheetStyles } from "@/constants/sheetStyles";
import {
  ACCENT,
  ACCENT_FILL,
  BG,
  BORDER,
  DESTRUCTIVE,
  DESTRUCTIVE_BORDER_STRONG,
  DESTRUCTIVE_FILL_SUBTLE,
  Friend,
  HEADER_BLACK,
  MUTED2,
  MUTED3,
  OVERLAY_DARK,
  OVERLAY_DIM,
  OVERLAY_MID,
  OVERLAY_SOFT,
  PROFILE_HEADER_FADE_GRADIENT,
  PROFILE_HEADER_FADE_LOCATIONS,
  RADIUS_MD,
  RADIUS_XL,
  SPACE_2,
  SPACE_3,
  SPACE_4,
  SPACE_5,
  SPACE_6,
  SURFACE,
  TEXT,
  TYPE_BODY,
  TYPE_CAPTION,
  TYPE_FINE,
  TYPE_LEAD,
  TYPE_NANO,
  cardMetaText,
  fonts,
  getTabHeaderLayout,
  listRowTitleText,
  listSectionTitle,
  profileLocationText,
  profileNameText,
  sectionLinkText,
  sheetTitleText,
  stackNavigationBackBtn,
  synqOutlineAddBtnCompact,
  synqOutlineAddBtnTextCompact,
} from "@/constants/Variables";
import BackButton from "@/src/components/BackButton";
import CommunityFeedSection from "@/src/components/community/CommunityFeedSection";
import CommunityPlansSection from "@/src/components/community/CommunityPlansSection";
import AddMembersToGroupSheet from "@/src/components/friends/AddMembersToGroupSheet";
import { GROUP_BORDER } from "@/src/components/friends/groupsListStyles";
import HeaderIconButton from "@/src/components/HeaderIconButton";
import { PageLoadSkeleton } from "@/src/components/loading/BrandSkeletons";
import SpringBottomSheet from "@/src/components/sheets/SpringBottomSheet";
import StackScreenHeader from "@/src/components/StackScreenHeader";
import {
  acceptCommunityGroupInvite,
  communityGroupInviteRef,
  sendCommunityGroupInvites,
  subscribePendingCommunityGroupInvites,
} from "@/src/lib/communityGroupInvites";
import type { CommunityGroupPlan } from "@/src/lib/communityGroupPlans";
import {
  communityGroupRef,
  deleteCommunityGroup,
  joinCommunityGroup,
  leaveCommunityGroup,
  mapCommunityGroupDoc,
  removeMemberFromCommunityGroup,
  type CommunityGroup,
} from "@/src/lib/communityGroups";
import type { CommunityPlanMemberProfile } from "@/src/lib/communityPlanMembers";
import { fetchOrCreateCommunityShareCode } from "@/src/lib/communityShareCode";
import { buildCommunityShareWebUrl } from "@/src/lib/communityShareUrl";
import { auth, db } from "@/src/lib/firebase";
import { resolveAvatar } from "@/src/lib/helpers";
import { shareCommunityJoinLink } from "@/src/lib/shareCommunityLink";
import { friendProfileCacheByUser, friendsListCacheByUser } from "@/src/lib/socialCache";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { arrayUnion, doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

function SectionDelimiter() {
  return <View style={styles.sectionDelimiter} />;
}

function formatNameList(names: string[]): string {
  if (names.length === 0) return "them";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function invitedFriendsSuccessMessage(
  memberIds: string[],
  friends: Friend[],
  groupName: string
): string {
  const byId = new Map(friends.map((f) => [f.id, f]));
  const names = memberIds.map((id) => byId.get(id)?.displayName?.trim() || "Friend");
  const group = groupName.trim() || "the group";
  return `Invite sent to ${formatNameList(names)} for ${group}`;
}

const COVER_HERO_HEIGHT = 168;
const MEMBER_AVATAR_SIZE = 48;
const MEMBER_PREVIEW_COUNT = 6;
const COVER_HERO_GRADIENT = [
  OVERLAY_DIM,
  OVERLAY_SOFT,
  OVERLAY_DARK,
  BG,
] as const;
const COVER_HERO_GRADIENT_LOCATIONS = [0, 0.42, 0.82, 1] as const;

type MemberRow = {
  id: string;
  displayName: string;
  imageurl?: string;
};

export default function CommunityGroupDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id: groupId, planId: initialPlanId } = useLocalSearchParams<{
    id?: string;
    planId?: string;
  }>();
  const uid = auth.currentUser?.uid ?? "";
  const friends = uid ? friendsListCacheByUser[uid] ?? [] : [];

  const [group, setGroup] = useState<CommunityGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<"not_found" | "permission" | null>(null);
  const [memberProfiles, setMemberProfiles] = useState<Record<string, MemberRow>>({});
  const [addSheetVisible, setAddSheetVisible] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [pendingInviteIds, setPendingInviteIds] = useState<string[]>([]);
  const [successVisible, setSuccessVisible] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const pendingMemberIdsRef = useRef<string[] | null>(null);
  const optionsPendingRef = useRef<(() => void) | null>(null);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [leaveVisible, setLeaveVisible] = useState(false);
  const [joinBusy, setJoinBusy] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [pendingRemoveMember, setPendingRemoveMember] = useState<{
    id: string;
    displayName: string;
  } | null>(null);
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState<string | undefined>();
  const [alertMessage, setAlertMessage] = useState("");

  const showAlert = useCallback((title: string, message: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  }, []);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/friends");
  };

  useEffect(() => {
    if (!groupId || !uid) return;
    const unsub = subscribePendingCommunityGroupInvites(groupId, setPendingInviteIds, () => {});
    return unsub;
  }, [groupId, uid]);

  useEffect(() => {
    if (!groupId) return;
    const ref = communityGroupRef(groupId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setGroup(null);
          setLoadError("not_found");
          setLoading(false);
          return;
        }
        setLoadError(null);
        const data = snap.data() as Record<string, unknown>;
        const serverMemberIds = Array.isArray(data.memberIds)
          ? [...new Set((data.memberIds as string[]).filter(Boolean))]
          : [];
        const pending = pendingMemberIdsRef.current;
        let memberIds = serverMemberIds;
        if (pending) {
          const serverHasPending = pending.every((id) => serverMemberIds.includes(id));
          if (serverHasPending && serverMemberIds.length >= pending.length) {
            pendingMemberIdsRef.current = null;
          } else {
            memberIds = pending;
          }
        }
        setGroup({ ...mapCommunityGroupDoc(snap.id, data), memberIds });
        setLoading(false);
      },
      (err) => {
        const code = (err as { code?: string }).code;
        setLoadError(code === "permission-denied" ? "permission" : "not_found");
        setGroup(null);
        setLoading(false);
      }
    );
    return unsub;
  }, [groupId]);

  useEffect(() => {
    if (!group) return;

    let cancelled = false;
    const MAX_REMOTE_PROFILE_FETCHES = 40;

    void (async () => {
      const next: Record<string, MemberRow> = {};
      const needsFetch: string[] = [];

      for (const memberId of group.memberIds) {
        const friend = friends.find((f) => f.id === memberId);
        const preview = group.memberPreviews?.[memberId];
        const displayName =
          friend?.displayName?.trim() ||
          preview?.displayName?.trim() ||
          "Member";
        const imageurl =
          (friend as { imageurl?: string } | undefined)?.imageurl ||
          preview?.imageurl;

        if (friend) {
          next[memberId] = {
            id: memberId,
            displayName,
            imageurl,
          };
        } else if (preview?.displayName) {
          next[memberId] = {
            id: memberId,
            displayName,
            imageurl,
          };
        } else {
          next[memberId] = {
            id: memberId,
            displayName: "Member",
            imageurl: undefined,
          };
          needsFetch.push(memberId);
        }
      }

      const toFetch = needsFetch.slice(0, MAX_REMOTE_PROFILE_FETCHES);
      await Promise.all(
        toFetch.map(async (memberId) => {
          try {
            const snap = await getDoc(doc(db, "users", memberId));
            if (!snap.exists()) return;
            const data = snap.data() as {
              displayName?: string;
              imageurl?: string;
            };
            next[memberId] = {
              id: memberId,
              displayName: String(data.displayName || "").trim() || "Member",
              imageurl: data.imageurl,
            };
          } catch {
            // keep placeholder
          }
        })
      );

      if (!cancelled) setMemberProfiles({ ...next });
    })();

    return () => {
      cancelled = true;
    };
  }, [group, friends]);

  // Keep this group's id on the viewer's communityGroupIds so co-member profile reads work.
  useEffect(() => {
    if (!uid || !group?.id || !group.memberIds.includes(uid)) return;
    void updateDoc(doc(db, "users", uid), {
      communityGroupIds: arrayUnion(group.id),
    }).catch(() => {});
  }, [uid, group?.id, group?.memberIds]);

  const isMember = !!group && !!uid && group.memberIds.includes(uid);
  const isCreator = !!group && !!uid && group.creatorId === uid;

  const memberRows = useMemo(() => {
    if (!group) return [];
    return group.memberIds.map((memberId) => {
      const profile = memberProfiles[memberId];
      return {
        id: memberId,
        displayName: profile?.displayName || "Member",
        imageurl: profile?.imageurl,
      };
    });
  }, [group, memberProfiles]);

  const friendIds = useMemo(
    () => new Set(friends.map((friend) => friend.id)),
    [friends]
  );

  const viewerDisplayName = auth.currentUser?.displayName?.trim() || "You";

  const openMemberProfile = useCallback(
    (
      member: MemberRow,
      extraParams?: Record<string, string>
    ) => {
      if (uid) {
        if (!friendProfileCacheByUser[uid]) {
          friendProfileCacheByUser[uid] = {};
        }
        friendProfileCacheByUser[uid][member.id] = {
          id: member.id,
          displayName: member.displayName,
          imageurl: member.imageurl,
        } as any;
      }
      router.push({
        pathname: "/friend-profile",
        params: {
          friendId: member.id,
          from: "community",
          communityGroupId: group?.id || "",
          communityGroupName: group?.name || "",
          ...extraParams,
        },
      });
    },
    [router, uid, group?.id, group?.name]
  );

  const openGoerProfile = useCallback(
    (target: CommunityPlanMemberProfile, plan: CommunityGroupPlan) => {
      openMemberProfile(
        {
          id: target.id,
          displayName: target.displayName,
          imageurl: target.imageurl,
        },
        {
          communityPlanId: plan.id,
          communityPlanTitle: plan.title,
        }
      );
    },
    [openMemberProfile]
  );

  const handleJoin = async () => {
    if (!uid || !group || joinBusy) return;
    setJoinBusy(true);
    try {
      const inviteSnap = await getDoc(communityGroupInviteRef(uid, group.id));
      if (inviteSnap.exists()) {
        const data = inviteSnap.data() as Record<string, unknown>;
        await acceptCommunityGroupInvite(uid, {
          id: group.id,
          groupId: group.id,
          groupName: group.name,
          fromUserId: String(data.fromUserId || "").trim(),
          fromUserName: String(data.fromUserName || "").trim() || "Friend",
          fromUserImageUrl: data.fromUserImageUrl
            ? String(data.fromUserImageUrl)
            : undefined,
          createdAt: data.createdAt,
        });
      } else {
        await joinCommunityGroup(uid, group.id, group.memberIds);
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: unknown) {
      showAlert("Could not join", e instanceof Error ? e.message : "Try again.");
    } finally {
      setJoinBusy(false);
    }
  };

  const handleShareJoinLink = async () => {
    if (!group || shareBusy) return;
    if (!isMember) {
      showAlert("Join to share", "Join this community before sharing the invite link.");
      return;
    }
    setShareBusy(true);
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const code =
        group.shareCode?.trim().toUpperCase() ||
        (await fetchOrCreateCommunityShareCode(group.id));
      const url = buildCommunityShareWebUrl(code);
      await shareCommunityJoinLink(url, group.name);
    } catch (err: unknown) {
      showAlert(
        "Couldn't share",
        err instanceof Error ? err.message : "Please try again."
      );
    } finally {
      setShareBusy(false);
    }
  };

  const handleInviteFriends = async (memberIds: string[]) => {
    if (!uid || !group || memberIds.length === 0 || !isMember) return;

    const me = auth.currentUser;
    const inviterName = me?.displayName?.trim() || "Friend";
    const inviterImage = me?.photoURL;

    setInviteBusy(true);
    setAddSheetVisible(false);
    try {
      const sent = await sendCommunityGroupInvites(
        uid,
        inviterName,
        inviterImage,
        group,
        memberIds
      );
      if (sent.length === 0) {
        showAlert("No invites sent", "Those friends may already have a pending invite.");
        return;
      }
      setSuccessMessage(invitedFriendsSuccessMessage(sent, friends, group.name));
      setSuccessVisible(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => {
        setSuccessVisible(false);
        setSuccessMessage("");
      }, 1800);
    } catch (e: unknown) {
      showAlert("Could not send invites", e instanceof Error ? e.message : "Try again.");
    } finally {
      setInviteBusy(false);
    }
  };

  const handleRemoveMember = (memberId: string, displayName: string) => {
    if (!uid || !group) return;
    if (!isCreator && memberId !== uid) return;
    setPendingRemoveMember({ id: memberId, displayName });
  };

  const confirmRemoveMember = () => {
    if (!uid || !group || !pendingRemoveMember) return;
    const { id: memberId } = pendingRemoveMember;
    setPendingRemoveMember(null);

    const previousMemberIds = group.memberIds;
    const nextMemberIds = previousMemberIds.filter((id) => id !== memberId);

    pendingMemberIdsRef.current = nextMemberIds;
    setGroup({ ...group, memberIds: nextMemberIds });

    void removeMemberFromCommunityGroup(group.id, previousMemberIds, memberId).catch(() => {
      pendingMemberIdsRef.current = null;
      setGroup((g) => (g ? { ...g, memberIds: previousMemberIds } : g));
      showAlert("Couldn't remove member", "Please try again.");
    });
  };

  const handleDelete = async () => {
    if (!group || !isCreator) return;
    try {
      await deleteCommunityGroup(group.id);
      setDeleteVisible(false);
      goBack();
    } catch {
      showAlert("Couldn't delete group", "Please try again.");
    }
  };

  const handleLeave = async () => {
    if (!uid || !group || !isMember) return;
    try {
      await leaveCommunityGroup(uid, group.id, group.memberIds);
      setLeaveVisible(false);
      goBack();
    } catch {
      showAlert("Couldn't leave group", "Please try again.");
    }
  };

  const memberPreview = showAllMembers
    ? memberRows
    : memberRows.slice(0, MEMBER_PREVIEW_COUNT);

  if (!groupId) {
    return (
      <SafeAreaView style={styles.screen} edges={["top", "bottom", "left", "right"]}>
        <Text style={styles.errorText}>Group not found.</Text>
      </SafeAreaView>
    );
  }

  const memberCount = group?.memberIds.length ?? 0;
  const memberLabel =
    memberCount === 1 ? "1 member" : `${memberCount} members`;

  const coverPhotoUrl = group?.coverPhotoUrl?.trim() || "";
  const hasCover = coverPhotoUrl.length > 0;
  const coverHeight = insets.top + COVER_HERO_HEIGHT;
  const coverNavLayout = getTabHeaderLayout(insets.top);

  const renderMemberAvatar = (member: MemberRow, showAdmin = false) => (
    <TouchableOpacity
      key={member.id}
      style={styles.memberTile}
      activeOpacity={0.82}
      onPress={() => openMemberProfile(member)}
      accessibilityRole="button"
      accessibilityLabel={member.displayName}
    >
      <View style={styles.memberTileAvatarOuter}>
        <View style={styles.memberTileAvatarWrap}>
          <ExpoImage
            source={{ uri: resolveAvatar(member.imageurl) }}
            style={styles.memberTileAvatar}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        </View>
      </View>
      <Text style={styles.memberTileName} numberOfLines={1}>
        {member.displayName.split(" ")[0]}
      </Text>
      {showAdmin && member.id === group?.creatorId ? (
        <View style={styles.adminBadge}>
          <Text style={styles.adminBadgeText}>Admin</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );

  const renderJoinButton = (compact = false) => (
    <TouchableOpacity
      style={[
        synqOutlineAddBtnCompact,
        styles.joinCommunityBtnRow,
        compact && styles.joinCommunityBtnCompact,
        joinBusy && styles.joinCommunityBtnDisabled,
      ]}
      disabled={joinBusy}
      onPress={() => void handleJoin()}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={`Join ${group?.name || "community"}`}
    >
      <>
        <Ionicons
          name="person-add-outline"
          size={16}
          color={ACCENT}
          style={joinBusy ? { opacity: 0.5 } : undefined}
        />
        <Text
          style={[
            synqOutlineAddBtnTextCompact,
            joinBusy && { opacity: 0.5 },
          ]}
        >
          Join
        </Text>
      </>
    </TouchableOpacity>
  );

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView
        style={styles.flex}
        edges={["bottom", "left", "right"]}
      >
        {!hasCover && group ? (
          <StackScreenHeader
            title={group.name}
            onBack={goBack}
            right={
              <View style={styles.headerActions}>
                {isMember ? (
                  <HeaderIconButton
                    name="share-outline"
                    size={22}
                    onPress={() => void handleShareJoinLink()}
                    accessibilityLabel="Share join link"
                    disabled={shareBusy}
                  />
                ) : null}
                {isMember ? (
                  <HeaderIconButton
                    name="ellipsis-horizontal"
                    size={22}
                    onPress={() => setOptionsVisible(true)}
                    accessibilityLabel="Community options"
                  />
                ) : null}
              </View>
            }
          />
        ) : null}

        {loading ? (
          <View style={styles.loading}>
            <PageLoadSkeleton />
          </View>
        ) : !group ? (
          <View style={styles.loading}>
            <Text style={styles.errorText}>
              {loadError === "permission"
                ? "You don't have access to this group."
                : "This group no longer exists."}
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {hasCover ? (
              <View style={[styles.coverHeroWrap, { height: coverHeight }]}>
                <ExpoImage
                  source={{ uri: coverPhotoUrl }}
                  style={styles.coverHeroImage}
                  contentFit="cover"
                  transition={160}
                  cachePolicy="memory-disk"
                  recyclingKey={coverPhotoUrl}
                />
                <View
                  pointerEvents="none"
                  style={[styles.coverStatusBarFill, { height: insets.top }]}
                />
                <LinearGradient
                  colors={[...PROFILE_HEADER_FADE_GRADIENT]}
                  locations={[...PROFILE_HEADER_FADE_LOCATIONS]}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={[
                    styles.coverTopNavGradient,
                    { height: coverNavLayout.gradientHeight },
                  ]}
                  pointerEvents="none"
                />
                <LinearGradient
                  colors={[...COVER_HERO_GRADIENT]}
                  locations={[...COVER_HERO_GRADIENT_LOCATIONS]}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={styles.coverHeroGradient}
                  pointerEvents="none"
                />
                <View
                  style={[styles.coverNavOverlay, { paddingTop: coverNavLayout.top }]}
                  pointerEvents="box-none"
                >
                  <BackButton onPress={goBack} style={styles.coverBackBtn} />
                  <View style={styles.coverNavSpacer} />
                  <View style={styles.coverNavRight}>
                    {isMember ? (
                      <HeaderIconButton
                        name="share-outline"
                        size={22}
                        onPress={() => void handleShareJoinLink()}
                        accessibilityLabel="Share join link"
                        disabled={shareBusy}
                      />
                    ) : null}
                    {isMember ? (
                      <HeaderIconButton
                        name="ellipsis-horizontal"
                        size={22}
                        onPress={() => setOptionsVisible(true)}
                        accessibilityLabel="Community options"
                      />
                    ) : null}
                  </View>
                </View>
              </View>
            ) : null}

            <View style={[styles.profileSection, hasCover && styles.profileSectionWithCover]}>
              <View style={styles.profileTitleRow}>
                <View style={styles.profileTitleMain}>
                  <Text style={styles.profileName}>{group.name}</Text>
                  <Text style={styles.profileMeta}>
                    {group.category ? (
                      <Text style={styles.profileMetaMuted}>{group.category}</Text>
                    ) : null}
                    {group.category && group.location ? (
                      <>
                        <Text style={styles.profileMetaMuted}> </Text>
                        <Text style={styles.profileMetaBullet}>•</Text>
                        <Text style={styles.profileMetaMuted}> </Text>
                      </>
                    ) : null}
                    {group.location ? (
                      <Text style={styles.profileMetaMuted}>{group.location}</Text>
                    ) : null}
                  </Text>
                </View>
                {!isMember ? renderJoinButton(true) : null}
              </View>

              {group.about ? (
                <Text style={styles.profileAbout}>{group.about}</Text>
              ) : null}
            </View>

            <CommunityFeedSection
              groupId={group.id}
              groupName={group.name}
              uid={uid}
              isMember={isMember}
              isCreator={isCreator}
            />

            <SectionDelimiter />

            <CommunityPlansSection
              groupId={group.id}
              groupName={group.name}
              uid={uid}
              viewerDisplayName={viewerDisplayName}
              isMember={isMember}
              isCreator={isCreator}
              memberProfiles={memberProfiles}
              friendIds={friendIds}
              initialPlanId={
                typeof initialPlanId === "string" ? initialPlanId : undefined
              }
              onAddFriend={openGoerProfile}
              onViewGoer={openGoerProfile}
            />

            <SectionDelimiter />

            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderMain}>
                  <Text style={styles.sectionTitle}>Members</Text>
                  <Text style={styles.sectionMetaBelow}>{memberLabel}</Text>
                </View>
                {isMember && memberRows.length > 0 ? (
                  <TouchableOpacity
                    onPress={() => setShowAllMembers((prev) => !prev)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.sectionHeaderAction}
                  >
                    <Text style={styles.sectionLink}>
                      {showAllMembers ? "Show less" : "See all"}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {!isMember ? (
                <View style={styles.membersLockedRow}>
                  <Ionicons name="lock-closed-outline" size={16} color={MUTED2} />
                  <Text style={styles.membersLockedText}>
                    You can&apos;t see members until you join
                  </Text>
                </View>
              ) : memberRows.length === 0 ? (
                <Text style={styles.emptyMembers}>
                  No members yet. Invite friends from the menu.
                </Text>
              ) : showAllMembers ? (
                memberRows.map((item) => (
                  <View key={item.id} style={styles.memberRow}>
                    <TouchableOpacity
                      style={styles.memberMain}
                      activeOpacity={0.82}
                      onPress={() => openMemberProfile(item)}
                    >
                      <View style={styles.avatarRing}>
                        <ExpoImage
                          source={{ uri: resolveAvatar(item.imageurl) }}
                          style={styles.avatar}
                          cachePolicy="memory-disk"
                        />
                      </View>
                      <Text style={styles.memberName} numberOfLines={1}>
                        {item.displayName}
                      </Text>
                    </TouchableOpacity>
                    {(isCreator || item.id === uid) && item.id !== group.creatorId ? (
                      <TouchableOpacity
                        onPress={() =>
                          item.id === uid
                            ? setLeaveVisible(true)
                            : handleRemoveMember(item.id, item.displayName)
                        }
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityRole="button"
                        accessibilityLabel={
                          item.id === uid
                            ? `Leave ${group.name}`
                            : `Remove ${item.displayName} from community`
                        }
                        style={[synqOutlineAddBtnCompact, styles.removeMemberBtn]}
                      >
                        <Text
                          style={[
                            synqOutlineAddBtnTextCompact,
                            styles.removeMemberLabel,
                          ]}
                        >
                          {item.id === uid ? "Leave" : "Remove"}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalStrip}
                >
                  {memberPreview.map((member) => renderMemberAvatar(member, true))}
                </ScrollView>
              )}
            </View>
          </ScrollView>
        )}

      <AddMembersToGroupSheet
        visible={addSheetVisible}
        busy={inviteBusy}
        friends={friends}
        existingMemberIds={group?.memberIds ?? []}
        pendingInviteIds={pendingInviteIds}
        mode="invite"
        onClose={() => setAddSheetVisible(false)}
        onAdd={handleInviteFriends}
      />

      <SpringBottomSheet
        visible={optionsVisible}
        onClose={() => setOptionsVisible(false)}
        onClosed={() => {
          const action = optionsPendingRef.current;
          optionsPendingRef.current = null;
          action?.();
        }}
        contentStyle={styles.optionsSheetGroup}
        cardStyle={sheetStyles.sheetCard}
        footer={
          <TouchableOpacity
            style={styles.optionsCancel}
            onPress={() => setOptionsVisible(false)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={styles.optionsCancelText}>Cancel</Text>
          </TouchableOpacity>
        }
      >
        {isMember ? (
          <>
            <TouchableOpacity
              style={[styles.optionsRow, shareBusy && { opacity: 0.45 }]}
              disabled={shareBusy}
              onPress={() => {
                optionsPendingRef.current = () => {
                  void handleShareJoinLink();
                };
                setOptionsVisible(false);
              }}
              activeOpacity={0.75}
            >
              <Ionicons name="share-outline" size={22} color={TEXT} />
              <Text style={styles.optionsRowText}>Share join link</Text>
            </TouchableOpacity>
            <View style={styles.optionsDivider} />
            <TouchableOpacity
              style={styles.optionsRow}
              onPress={() => {
                optionsPendingRef.current = () => setAddSheetVisible(true);
                setOptionsVisible(false);
              }}
              activeOpacity={0.75}
            >
              <Ionicons name="person-add-outline" size={22} color={TEXT} />
              <Text style={styles.optionsRowText}>Invite friends</Text>
            </TouchableOpacity>
            <View style={styles.optionsDivider} />
          </>
        ) : null}
        {isCreator ? (
          <>
            <TouchableOpacity
              style={styles.optionsRow}
              onPress={() => {
                optionsPendingRef.current = () => {
                  if (!group) return;
                  router.push({
                    pathname: "/community-group/edit",
                    params: { id: group.id },
                  });
                };
                setOptionsVisible(false);
              }}
              activeOpacity={0.75}
            >
              <Ionicons name="create-outline" size={22} color={TEXT} />
              <Text style={styles.optionsRowText}>Edit community</Text>
            </TouchableOpacity>
            <View style={styles.optionsDivider} />
            <TouchableOpacity
              style={styles.optionsRow}
              onPress={() => {
                optionsPendingRef.current = () => setDeleteVisible(true);
                setOptionsVisible(false);
              }}
              activeOpacity={0.75}
            >
              <Ionicons name="trash-outline" size={22} color={DESTRUCTIVE} />
              <Text style={[styles.optionsRowText, styles.optionsDestructive]}>
                Delete group
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={styles.optionsRow}
            onPress={() => {
              optionsPendingRef.current = () => setLeaveVisible(true);
              setOptionsVisible(false);
            }}
            activeOpacity={0.75}
          >
            <Ionicons name="exit-outline" size={22} color={DESTRUCTIVE} />
            <Text style={[styles.optionsRowText, styles.optionsDestructive]}>Leave group</Text>
          </TouchableOpacity>
        )}
      </SpringBottomSheet>

      <Modal visible={successVisible} transparent animationType="fade">
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <Ionicons name="checkmark-circle" size={40} color={ACCENT} />
            <Text style={styles.successTitle}>{successMessage}</Text>
          </View>
        </View>
      </Modal>

      <ConfirmModal
        visible={deleteVisible}
        title="Delete group?"
        message={`Delete "${group?.name || "this group"}"? This cannot be undone.`}
        confirmText="Delete"
        destructive
        onCancel={() => setDeleteVisible(false)}
        onConfirm={() => void handleDelete()}
      />

      <ConfirmModal
        visible={leaveVisible}
        title="Leave group?"
        message={`Leave "${group?.name || "this group"}"?`}
        confirmText="Leave"
        destructive
        onCancel={() => setLeaveVisible(false)}
        onConfirm={() => void handleLeave()}
      />

      <ConfirmModal
        visible={pendingRemoveMember != null}
        title="Remove member?"
        message={
          pendingRemoveMember && group
            ? `Remove ${pendingRemoveMember.displayName} from ${group.name}?`
            : ""
        }
        confirmText="Remove"
        destructive
        onCancel={() => setPendingRemoveMember(null)}
        onConfirm={() => void confirmRemoveMember()}
      />

      <AlertModal
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        onClose={() => setAlertVisible(false)}
      />
    </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  flex: {
    flex: 1,
  },
  loading: {
    flex: 1,
  },
  errorText: {
    fontFamily: fonts.book,
    fontSize: TYPE_BODY,
    color: MUTED2,
    textAlign: "center",
    padding: SPACE_6,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: SPACE_5,
    paddingBottom: SPACE_2,
    gap: SPACE_3,
  },
  sectionHeaderMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  sectionHeaderAction: {
    paddingTop: 2,
  },
  sectionBlock: {
    paddingTop: SPACE_2,
  },
  sectionDelimiter: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: GROUP_BORDER,
    marginHorizontal: SPACE_5,
    marginVertical: SPACE_2,
  },
  sectionTitle: {
    ...listSectionTitle,
    marginTop: 0,
    marginBottom: 0,
  },
  sectionLink: {
    ...sectionLinkText,
  },
  sectionMetaInline: {
    fontFamily: fonts.book,
    fontSize: TYPE_CAPTION,
    color: MUTED2,
  },
  sectionMetaBelow: {
    ...cardMetaText,
  },
  membersLockedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: SPACE_5,
    paddingBottom: SPACE_4,
  },
  membersLockedText: {
    flex: 1,
    fontFamily: fonts.book,
    fontSize: TYPE_BODY,
    color: MUTED2,
    lineHeight: 20,
  },
  joinCommunityBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 14,
  },
  joinCommunityBtnCompact: {
    flexShrink: 0,
  },
  joinCommunityBtnDisabled: {
    opacity: 0.6,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  coverHeroWrap: {
    width: "100%",
    backgroundColor: SURFACE,
    overflow: "hidden",
    position: "relative",
  },
  coverHeroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  coverHeroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  coverStatusBarFill: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: HEADER_BLACK,
    zIndex: 2,
  },
  coverTopNavGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
  },
  coverNavOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACE_3,
    paddingBottom: SPACE_3,
    zIndex: 3,
  },
  coverBackBtn: {
    ...stackNavigationBackBtn,
    marginRight: 0,
  },
  coverNavSpacer: {
    flex: 1,
  },
  coverNavRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    minWidth: 40,
    justifyContent: "flex-end",
  },
  profileSection: {
    paddingHorizontal: SPACE_5,
    paddingTop: SPACE_4,
    paddingBottom: SPACE_3,
    gap: SPACE_2,
  },
  profileSectionWithCover: {
    paddingTop: SPACE_2,
  },
  profileTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACE_3,
  },
  profileTitleMain: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  profileHeader: {
    paddingHorizontal: SPACE_5,
    paddingTop: SPACE_4,
    paddingBottom: SPACE_3,
    gap: 6,
  },
  profileName: {
    ...profileNameText,
  },
  profileMeta: {
    ...profileLocationText,
    fontSize: TYPE_LEAD,
  },
  profileMetaMuted: {
    color: MUTED2,
  },
  profileMetaBullet: {
    fontFamily: fonts.book,
    fontSize: TYPE_NANO,
    color: MUTED2,
    lineHeight: 19,
  },
  horizontalStrip: {
    paddingHorizontal: SPACE_5,
    gap: SPACE_4,
    paddingBottom: SPACE_2,
  },
  memberTile: {
    width: MEMBER_AVATAR_SIZE + 8,
    alignItems: "center",
    gap: 6,
  },
  memberTileAvatarOuter: {
    width: MEMBER_AVATAR_SIZE,
    height: MEMBER_AVATAR_SIZE,
    position: "relative",
  },
  memberTileAvatarWrap: {
    width: MEMBER_AVATAR_SIZE,
    height: MEMBER_AVATAR_SIZE,
    borderRadius: MEMBER_AVATAR_SIZE / 2,
    overflow: "hidden",
    backgroundColor: SURFACE,
    position: "relative",
  },
  memberTileAvatar: {
    width: MEMBER_AVATAR_SIZE,
    height: MEMBER_AVATAR_SIZE,
  },
  memberTileName: {
    fontFamily: fonts.medium,
    fontSize: TYPE_CAPTION,
    color: TEXT,
    textAlign: "center",
    width: MEMBER_AVATAR_SIZE + 16,
  },
  adminBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: ACCENT_FILL,
  },
  adminBadgeText: {
    fontFamily: fonts.medium,
    fontSize: TYPE_FINE,
    color: ACCENT,
  },
  moreTile: {
    width: MEMBER_AVATAR_SIZE + 8,
    alignItems: "center",
    justifyContent: "center",
  },
  moreTileCircle: {
    width: MEMBER_AVATAR_SIZE,
    height: MEMBER_AVATAR_SIZE,
    borderRadius: MEMBER_AVATAR_SIZE / 2,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: MUTED3,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  moreTileText: {
    fontFamily: fonts.medium,
    fontSize: TYPE_FINE,
    color: MUTED2,
    textAlign: "center",
    lineHeight: 13,
  },
  profileAbout: {
    fontFamily: fonts.book,
    fontSize: TYPE_BODY,
    color: MUTED2,
    lineHeight: 22,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: SPACE_6,
  },
  emptyMembers: {
    fontFamily: fonts.book,
    fontSize: TYPE_BODY,
    color: MUTED2,
    paddingVertical: SPACE_6,
    paddingHorizontal: SPACE_5,
    textAlign: "center",
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: SPACE_5,
  },
  memberMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },
  avatarRing: {
    width: 48,
    height: 48,
    borderRadius: RADIUS_XL,
    marginRight: 12,
    overflow: "hidden",
    backgroundColor: SURFACE,
  },
  avatar: {
    width: 48,
    height: 48,
  },
  memberName: {
    flex: 1,
    ...listRowTitleText,
  },
  messageMemberBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  removeMemberBtn: {
    borderColor: DESTRUCTIVE_BORDER_STRONG,
    backgroundColor: DESTRUCTIVE_FILL_SUBTLE,
  },
  removeMemberLabel: {
    color: DESTRUCTIVE,
  },
  successOverlay: {
    flex: 1,
    backgroundColor: OVERLAY_MID,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACE_6,
  },
  successCard: {
    backgroundColor: BG,
    borderRadius: RADIUS_MD,
    padding: SPACE_6,
    alignItems: "center",
    gap: 12,
    minWidth: 260,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
  },
  successTitle: {
    fontFamily: fonts.medium,
    fontSize: TYPE_BODY,
    color: TEXT,
    textAlign: "center",
  },
  optionsSheetGroup: {
    paddingHorizontal: 12,
    paddingBottom: 34,
  },
  optionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  optionsRowText: {
    ...listRowTitleText,
  },
  optionsDestructive: {
    color: DESTRUCTIVE,
  },
  optionsDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER,
    marginLeft: 54,
  },
  optionsCancel: {
    marginTop: 10,
    paddingVertical: 16,
    alignItems: "center",
    backgroundColor: BG,
    borderRadius: RADIUS_MD,
    borderWidth: 1,
    borderColor: BORDER,
  },
  optionsCancelText: sheetTitleText,
});
