import ConfirmModal from "@/app/confirm-modal";
import {
  ACCENT,
  Friend,
  MUTED3,
  SPACE_6,
} from "@/constants/Variables";
import CommunitySection from "@/src/components/friends/CommunityGroupsSection";
import GroupsFeatureInfoModal from "@/src/components/friends/GroupsFeatureInfoModal";
import { groupsPageStyles } from "@/src/components/friends/groupsListStyles";
import {
  deleteFriendGroup,
  FriendGroup,
  subscribeFriendGroups,
} from "@/src/lib/friendGroups";
import { friendGroupsCacheByUser } from "@/src/lib/socialCache";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import CreateCircleModal from "./CreateCircleModal";
import GroupListAvatar from "./GroupListAvatar";
import GroupsSectionHeader from "./GroupsSectionHeader";

type Props = {
  userId: string;
  friends?: Friend[];
  listBottomInset?: number;
  onCreateGroup: (name: string, memberIds?: string[]) => Promise<string>;
};

function formatMemberCount(count: number): string {
  return count === 1 ? "1 member" : `${count} members`;
}

export default function GroupsListPane({
  userId,
  friends = [],
  listBottomInset = 40,
  onCreateGroup,
}: Props) {
  const router = useRouter();
  const cached = userId ? friendGroupsCacheByUser[userId] ?? [] : [];
  const [groups, setGroups] = useState<FriendGroup[]>(cached);
  const [loading, setLoading] = useState(cached.length === 0);
  const [createVisible, setCreateVisible] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [pendingDeleteGroup, setPendingDeleteGroup] = useState<FriendGroup | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [circlesInfoVisible, setCirclesInfoVisible] = useState(false);

  useEffect(() => {
    if (!userId) return;
    setLoading(groups.length === 0);
    const unsub = subscribeFriendGroups(
      userId,
      (next) => {
        friendGroupsCacheByUser[userId] = next;
        setGroups(next);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [userId]);

  const handleCreate = async (name: string, memberIds: string[] = []) => {
    setCreateBusy(true);
    try {
      const id = await onCreateGroup(name, memberIds);
      setCreateVisible(false);
      router.push({ pathname: "/friend-group/[id]", params: { id } });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Try again.";
      const permissionDenied =
        typeof message === "string" &&
        (message.includes("permission") || message.includes("PERMISSION_DENIED"));
      Alert.alert(
        "Could not create circle",
        permissionDenied
          ? "Firestore may be missing the new groups rules. Deploy firestore rules, then try again."
          : message
      );
    } finally {
      setCreateBusy(false);
    }
  };

  const openCreate = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCreateVisible(true);
  };

  const openGroup = (id: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: "/friend-group/[id]", params: { id } });
  };

  const promptDeleteGroup = (group: FriendGroup) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPendingDeleteGroup(group);
  };

  const handleConfirmDelete = async () => {
    const group = pendingDeleteGroup;
    if (!userId || !group) return;
    setDeleteBusy(true);
    try {
      await deleteFriendGroup(userId, group.id);
      setPendingDeleteGroup(null);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      Alert.alert(
        "Could not delete circle",
        err instanceof Error ? err.message : "Try again."
      );
    } finally {
      setDeleteBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={ACCENT} />
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          groupsPageStyles.scrollContent,
          { paddingBottom: listBottomInset },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={groupsPageStyles.section}>
          <View style={groupsPageStyles.sectionHeader}>
            <GroupsSectionHeader
              title="Your circles"
              onAdd={openCreate}
              addAccessibilityLabel="New circle"
              onInfo={() => setCirclesInfoVisible(true)}
              infoAccessibilityLabel="What are circles"
            />
          </View>

          {groups.map((group) => (
            <TouchableOpacity
              key={group.id}
              style={groupsPageStyles.circleCard}
              onPress={() => openGroup(group.id)}
              onLongPress={() => promptDeleteGroup(group)}
              delayLongPress={400}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`${group.name}, ${group.memberIds.length} members`}
              accessibilityHint="Long press to delete this circle"
            >
              <GroupListAvatar memberIds={group.memberIds} friends={friends} />
              <View style={groupsPageStyles.circleCardMain}>
                <Text style={groupsPageStyles.circleCardTitle} numberOfLines={1}>
                  {group.name}
                </Text>
                <Text style={groupsPageStyles.circleCardMeta} numberOfLines={1}>
                  {formatMemberCount(group.memberIds.length)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={MUTED3} />
            </TouchableOpacity>
          ))}

        </View>

        <CommunitySection userId={userId} friends={friends} />
      </ScrollView>

      <CreateCircleModal
        visible={createVisible}
        busy={createBusy}
        friends={friends}
        onClose={() => setCreateVisible(false)}
        onCreate={handleCreate}
      />

      <ConfirmModal
        visible={pendingDeleteGroup != null}
        title="Delete circle?"
        message={
          pendingDeleteGroup
            ? `Delete "${pendingDeleteGroup.name}"? This cannot be undone.`
            : ""
        }
        confirmText="Delete"
        destructive
        onCancel={() => {
          if (!deleteBusy) setPendingDeleteGroup(null);
        }}
        onConfirm={() => void handleConfirmDelete()}
      />

      <GroupsFeatureInfoModal
        visible={circlesInfoVisible}
        variant="circles"
        onClose={() => setCirclesInfoVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACE_6,
  },
});
