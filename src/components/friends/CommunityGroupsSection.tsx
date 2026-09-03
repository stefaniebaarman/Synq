import AlertModal from "@/app/alert-modal";
import {
  MUTED2,
  MUTED3,
} from "@/constants/Variables";
import CommunityGroupListAvatar from "@/src/components/friends/CommunityGroupListAvatar";
import CreateCommunityModal, {
  type CreateCommunityInput,
} from "@/src/components/community/CreateCommunityModal";
import GroupListCard, {
  GROUP_LIST_ANDROID_RIPPLE,
} from "@/src/components/friends/GroupListCard";
import GroupsFeatureInfoModal from "@/src/components/friends/GroupsFeatureInfoModal";
import GroupsSectionHeader from "@/src/components/friends/GroupsSectionHeader";
import { groupsPageStyles } from "@/src/components/friends/groupsListStyles";
import {
  CommunityGroup,
  createCommunityGroup,
  subscribeJoinedCommunityGroups,
} from "@/src/lib/communityGroups";
import { communityGroupsCacheByUser } from "@/src/lib/socialCache";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";

type Props = {
  userId: string;
};

function formatMemberCount(count: number): string {
  return count === 1 ? "1 member" : `${count} members`;
}

export default function CommunitySection({ userId }: Props) {
  const router = useRouter();
  const cached = userId ? communityGroupsCacheByUser[userId] ?? [] : [];
  const [joined, setJoined] = useState<CommunityGroup[]>(cached);
  const [createVisible, setCreateVisible] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [communityInfoVisible, setCommunityInfoVisible] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState<string | undefined>();
  const [alertMessage, setAlertMessage] = useState("");

  const showAlert = useCallback((title: string, message: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  }, []);

  useEffect(() => {
    if (!userId) return;
    const unsub = subscribeJoinedCommunityGroups(
      userId,
      (next) => {
        communityGroupsCacheByUser[userId] = next;
        setJoined(next);
      },
      () => {}
    );
    return unsub;
  }, [userId]);

  const openGroup = (id: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: "/community-group/[id]", params: { id } });
  };

  const openSearch = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/discover-communities");
  };

  const openCreate = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCreateVisible(true);
  };

  const handleCreate = async (input: CreateCommunityInput) => {
    if (!userId) return;
    setCreateBusy(true);
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const id = await createCommunityGroup(
        userId,
        {
          name: input.name,
          category: input.category,
          location: input.location,
          about: input.about,
        },
        input.coverUri ?? undefined
      );
      setCreateVisible(false);
      router.push({ pathname: "/community-group/[id]", params: { id } });
    } catch (err: unknown) {
      showAlert(
        "Could not create community",
        err instanceof Error ? err.message : "Try again."
      );
    } finally {
      setCreateBusy(false);
    }
  };

  return (
    <>
      <View style={groupsPageStyles.section}>
        <View style={groupsPageStyles.sectionHeader}>
          <GroupsSectionHeader
            title="Communities"
            onAdd={openCreate}
            addAccessibilityLabel="New community"
            onInfo={() => setCommunityInfoVisible(true)}
            infoAccessibilityLabel="What is community"
          />
        </View>

        <Pressable
          style={groupsPageStyles.browseRow}
          android_ripple={
            Platform.OS === "android" ? GROUP_LIST_ANDROID_RIPPLE : undefined
          }
          onPress={openSearch}
          accessibilityRole="button"
          accessibilityLabel="Find communities"
        >
          <View style={groupsPageStyles.browseRowIcon}>
            <Ionicons name="compass-outline" size={20} color={MUTED2} />
          </View>
          <Text style={groupsPageStyles.browseRowTitle}>Find communities</Text>
          <Ionicons name="chevron-forward" size={16} color={MUTED3} />
        </Pressable>

        {joined.map((group) => (
          <GroupListCard
            key={group.id}
            onPress={() => openGroup(group.id)}
            accessibilityLabel={`${group.name}, ${group.memberIds.length} members`}
          >
            <CommunityGroupListAvatar
              coverPhotoUrl={group.coverPhotoUrl}
              coverPhotoThumbUrl={group.coverPhotoThumbUrl}
            />
            <View style={groupsPageStyles.circleCardMain}>
              <Text style={groupsPageStyles.circleCardTitle} numberOfLines={1}>
                {group.name}
              </Text>
              <Text style={groupsPageStyles.circleCardMeta} numberOfLines={1}>
                {formatMemberCount(group.memberIds.length)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={MUTED3} />
          </GroupListCard>
        ))}
      </View>

      <CreateCommunityModal
        visible={createVisible}
        busy={createBusy}
        onClose={() => setCreateVisible(false)}
        onCreate={handleCreate}
      />

      <GroupsFeatureInfoModal
        visible={communityInfoVisible}
        variant="community"
        onClose={() => setCommunityInfoVisible(false)}
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

/** @deprecated Use CommunitySection */
export function CommunityGroupsRows(props: Props) {
  return <CommunitySection {...props} />;
}
