import {
  ACCENT,
  BORDER,
  MUTED2,
  SURFACE_ELEVATED,
  TEXT,
  TYPE_CAPTION,
  fonts,
} from "@/constants/Variables";
import { formatCommunitySynqGoingCount } from "@/src/lib/communityGroupPlans";
import { resolveAvatar } from "@/src/lib/helpers";
import type { CommunityPlanMemberProfile } from "@/src/lib/communityPlanMembers";
import { Image as ExpoImage } from "expo-image";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

type Props = {
  goers: CommunityPlanMemberProfile[];
  size?: number;
  maxVisible?: number;
  showCount?: boolean;
  showSynqBadge?: boolean;
};

export default function CommunityPlanGoerAvatars({
  goers,
  size = 26,
  maxVisible = 4,
  showCount = true,
  showSynqBadge = false,
}: Props) {
  if (goers.length === 0) {
    return showCount ? (
      <Text style={styles.emptyLabel}>No one going yet</Text>
    ) : null;
  }

  const visible = goers.slice(0, maxVisible);
  const overflow = goers.length - visible.length;
  const overlap = Math.round(size * 0.28);

  return (
    <View style={styles.row}>
      <View style={styles.stack}>
        {visible.map((goer, index) => (
          <View
            key={goer.id}
            style={[
              styles.avatarWrap,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                marginLeft: index === 0 ? 0 : -overlap,
                zIndex: visible.length - index,
              },
            ]}
          >
            <ExpoImage
              source={{ uri: resolveAvatar(goer.imageurl) }}
              style={[styles.avatar, { borderRadius: size / 2 }]}
              cachePolicy="memory-disk"
            />
            {showSynqBadge && goer.synqActive ? (
              <View style={[styles.synqDot, { right: -1, bottom: -1 }]} />
            ) : null}
          </View>
        ))}
        {overflow > 0 ? (
          <View
            style={[
              styles.overflow,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                marginLeft: -overlap,
              },
            ]}
          >
            <Text style={[styles.overflowText, { fontSize: Math.max(10, size * 0.34) }]}>
              +{overflow}
            </Text>
          </View>
        ) : null}
      </View>
      {showCount ? (
        <Text style={styles.countLabel} numberOfLines={1}>
          {formatCommunitySynqGoingCount(goers.length)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },
  stack: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarWrap: {
    borderWidth: 1.5,
    borderColor: "#101214",
    backgroundColor: SURFACE_ELEVATED,
    overflow: "visible",
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
  overflow: {
    borderWidth: 1.5,
    borderColor: "#101214",
    backgroundColor: SURFACE_ELEVATED,
    alignItems: "center",
    justifyContent: "center",
  },
  overflowText: {
    fontFamily: fonts.medium,
    color: MUTED2,
  },
  countLabel: {
    fontFamily: fonts.medium,
    fontSize: TYPE_CAPTION,
    color: ACCENT,
    flexShrink: 1,
  },
  emptyLabel: {
    fontFamily: fonts.book,
    fontSize: TYPE_CAPTION,
    color: MUTED2,
  },
  synqDot: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: ACCENT,
    borderWidth: 1.5,
    borderColor: BORDER,
  },
});
