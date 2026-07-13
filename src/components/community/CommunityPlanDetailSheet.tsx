import CommunityPlanGoerAvatars from "@/src/components/community/CommunityPlanGoerAvatars";
import SpringBottomSheet from "@/src/components/sheets/SpringBottomSheet";
import { sheetStyles } from "@/constants/sheetStyles";
import {
  type CommunityPlanMemberProfile,
} from "@/src/lib/communityPlanMembers";
import {
  formatCommunitySynqGoingCount,
  getCommunitySynqCardMetaParts,
  type CommunityGroupPlan,
} from "@/src/lib/communityGroupPlans";
import { resolveAvatar } from "@/src/lib/helpers";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import React, { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ACCENT,
  BG,
  BORDER,
  BUTTON_RADIUS,
  DESTRUCTIVE,
  MUTED2,
  RADIUS_LG,
  RADIUS_MD,
  SPACE_3,
  SPACE_4,
  SPACE_5,
  SURFACE_ELEVATED,
  TEXT,
  TYPE_BODY,
  TYPE_CAPTION,
  TYPE_CTA,
  TYPE_FINE,
  TYPE_LEAD,
  TYPE_SUBHEAD,
  cardMetaText,
  cardTitleText,
  fonts,
  formSectionLabel,
  sheetTitleText,
} from "@/constants/Variables";

type Props = {
  visible: boolean;
  plan: CommunityGroupPlan | null;
  goers: CommunityPlanMemberProfile[];
  uid: string;
  isMember: boolean;
  isGoing: boolean;
  busy: boolean;
  friendIds: Set<string>;
  groupName: string;
  onClose: () => void;
  onJoin: () => void;
  onLeave: () => void;
  onAddFriend: (target: CommunityPlanMemberProfile) => void;
  onViewGoer?: (target: CommunityPlanMemberProfile) => void;
};

function firstName(displayName: string): string {
  return String(displayName || "").trim().split(/\s+/)[0] || "Member";
}

export default function CommunityPlanDetailSheet({
  visible,
  plan,
  goers,
  uid,
  isMember,
  isGoing,
  busy,
  friendIds,
  groupName,
  onClose,
  onJoin,
  onLeave,
  onAddFriend,
  onViewGoer,
}: Props) {
  const insets = useSafeAreaInsets();
  const [selectedGoer, setSelectedGoer] = useState<CommunityPlanMemberProfile | null>(
    null
  );

  useEffect(() => {
    if (!visible) setSelectedGoer(null);
  }, [visible]);

  if (!plan) return null;

  const metaParts = getCommunitySynqCardMetaParts(plan.date, plan.time, plan.location);
  const handleGoerPress = (goer: CommunityPlanMemberProfile) => {
    if (!isMember || goer.id === uid) return;
    if (friendIds.has(goer.id)) {
      onViewGoer?.(goer);
      return;
    }
    setSelectedGoer(goer);
  };

  const closeGoerActions = () => setSelectedGoer(null);

  const handleAddGoer = () => {
    if (!selectedGoer) return;
    const target = selectedGoer;
    closeGoerActions();
    onAddFriend(target);
  };

  return (
    <>
      <SpringBottomSheet
        visible={visible}
        onClose={onClose}
        cardStyle={[
          styles.sheet,
          { paddingBottom: Math.max(insets.bottom, 16) + SPACE_4 },
        ]}
      >
        <Text style={styles.title} numberOfLines={2}>
          {plan.title}
        </Text>
        <Text style={styles.meta}>{metaParts.join(" • ")}</Text>
        <Text style={styles.groupLabel}>{groupName}</Text>

        <View style={styles.goersSection}>
          <Text style={styles.sectionLabel}>
            {goers.length === 0
              ? "No one going yet"
              : formatCommunitySynqGoingCount(goers.length)}
          </Text>
          {goers.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.goerStrip}
            >
              {goers.map((goer) => {
                const isSelf = goer.id === uid;
                const isCreator = goer.id === plan.creatorId;
                const canTap = isMember && !isSelf;
                const TileWrapper = canTap ? TouchableOpacity : View;

                return (
                  <TileWrapper
                    key={goer.id}
                    style={styles.goerTile}
                    {...(canTap
                      ? {
                          onPress: () => handleGoerPress(goer),
                          activeOpacity: 0.82,
                          accessibilityRole: "button" as const,
                          accessibilityLabel: isCreator
                            ? `${firstName(goer.displayName)}, creator`
                            : `${firstName(goer.displayName)}, tap for options`,
                        }
                      : {})}
                  >
                    <View style={styles.goerAvatarRing}>
                      <ExpoImage
                        source={{ uri: resolveAvatar(goer.imageurl) }}
                        style={styles.goerAvatar}
                        cachePolicy="memory-disk"
                      />
                    </View>
                    <Text style={styles.goerName} numberOfLines={1}>
                      {isSelf ? "You" : firstName(goer.displayName)}
                    </Text>
                    {isCreator ? (
                      <View style={styles.creatorBadge}>
                        <Ionicons name="star" size={9} color={ACCENT} />
                        <Text style={styles.creatorBadgeText}>Creator</Text>
                      </View>
                    ) : null}
                  </TileWrapper>
                );
              })}
            </ScrollView>
          ) : (
            <CommunityPlanGoerAvatars goers={[]} />
          )}
        </View>

        <View style={styles.actions}>
          {isMember ? (
            isGoing ? (
              <TouchableOpacity
                style={styles.leaveBtn}
                onPress={onLeave}
                disabled={busy}
                activeOpacity={0.85}
              >
                <Text style={[styles.leaveBtnText, busy && { opacity: 0.5 }]}>
                  Leave
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={onJoin}
                disabled={busy}
                activeOpacity={0.85}
              >
                <Text style={[styles.primaryBtnText, busy && { opacity: 0.5 }]}>
                  Join
                </Text>
              </TouchableOpacity>
            )
          ) : (
            <Text style={styles.lockedCopy}>
              Join {groupName} to see who's going and coordinate.
            </Text>
          )}
        </View>
      </SpringBottomSheet>

      <SpringBottomSheet
        visible={!!selectedGoer}
        onClose={closeGoerActions}
        contentStyle={[
          styles.goerActionGroup,
          { paddingBottom: Math.max(insets.bottom, 12) + 8 },
        ]}
        header={
          selectedGoer ? (
            <Text style={styles.goerActionTitle} numberOfLines={1}>
              {firstName(selectedGoer.displayName)}
            </Text>
          ) : null
        }
        cardStyle={sheetStyles.sheetCard}
        footer={
          <TouchableOpacity
            style={styles.goerActionCancel}
            onPress={closeGoerActions}
            activeOpacity={0.85}
          >
            <Text style={styles.goerActionCancelText}>Cancel</Text>
          </TouchableOpacity>
        }
      >
        <TouchableOpacity
          style={styles.goerActionOption}
          onPress={handleAddGoer}
          activeOpacity={0.75}
        >
          <Ionicons name="person-add-outline" size={22} color={TEXT} />
          <Text style={styles.goerActionOptionText}>Add friend</Text>
        </TouchableOpacity>
      </SpringBottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: BG,
    borderRadius: RADIUS_LG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    paddingTop: SPACE_3,
    paddingHorizontal: SPACE_5,
    gap: SPACE_3,
    maxHeight: "82%",
    overflow: "hidden",
  },
  title: {
    ...cardTitleText,
    fontSize: TYPE_CTA,
  },
  meta: {
    ...cardMetaText,
  },
  groupLabel: {
    fontFamily: fonts.book,
    fontSize: TYPE_CAPTION,
    color: MUTED2,
  },
  goersSection: {
    gap: SPACE_3,
  },
  sectionLabel: {
    ...formSectionLabel,
    color: MUTED2,
    fontSize: TYPE_CAPTION,
    letterSpacing: 0.4,
  },
  goerStrip: {
    gap: SPACE_4,
    paddingRight: SPACE_4,
  },
  goerTile: {
    width: 72,
    alignItems: "center",
    gap: 4,
  },
  goerAvatarRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: "visible",
  },
  goerAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: SURFACE_ELEVATED,
  },
  goerName: {
    fontFamily: fonts.medium,
    fontSize: TYPE_CAPTION,
    color: TEXT,
    textAlign: "center",
  },
  creatorBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    marginTop: 1,
  },
  creatorBadgeText: {
    fontFamily: fonts.book,
    fontSize: TYPE_FINE,
    color: ACCENT,
  },
  actions: {
    gap: SPACE_3,
    paddingTop: SPACE_3,
  },
  primaryBtn: {
    minHeight: 48,
    borderRadius: BUTTON_RADIUS,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    fontFamily: fonts.heavy,
    fontSize: TYPE_BODY,
    color: BG,
  },
  leaveBtn: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  leaveBtnText: {
    fontFamily: fonts.medium,
    fontSize: TYPE_LEAD,
    color: DESTRUCTIVE,
  },
  lockedCopy: {
    fontFamily: fonts.book,
    fontSize: TYPE_BODY,
    color: MUTED2,
    textAlign: "center",
    paddingVertical: SPACE_3,
  },
  goerActionGroup: {
    paddingHorizontal: 12,
  },
  goerActionTitle: {
    color: MUTED2,
    fontFamily: fonts.medium,
    fontSize: TYPE_CAPTION,
    textAlign: "center",
    marginBottom: 10,
    paddingHorizontal: 24,
  },
  goerActionOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 14,
  },
  goerActionOptionText: {
    color: TEXT,
    fontSize: TYPE_SUBHEAD,
    fontFamily: fonts.medium,
  },
  goerActionCancel: {
    marginTop: 10,
    backgroundColor: BG,
    borderRadius: RADIUS_MD,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 16,
    alignItems: "center",
  },
  goerActionCancelText: sheetTitleText,
});
