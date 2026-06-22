import { getStackAvatarUris, resolveAvatar } from "@/src/lib/helpers";
import {
  ACCENT,
  BORDER,
  BORDER_SOFT,
  SURFACE_ELEVATED,
  SURFACE_MUTED,
  SURFACE_RAISED,
} from "@/constants/Variables";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";

const AVATAR_SLOT = 48;
const GROUP_SURFACE = SURFACE_RAISED;

type FriendLike = { id: string; imageurl?: string };

type Props = {
  memberIds: string[];
  friends: FriendLike[];
};

export default function GroupListAvatar({ memberIds, friends }: Props) {
  const stackUris = useMemo(() => {
    if (memberIds.length === 0) return [];

    const byId = new Map(friends.map((f) => [f.id, f]));
    const images: Record<string, string> = {};
    for (const id of memberIds) {
      const friend = byId.get(id);
      images[id] = resolveAvatar(friend?.imageurl);
    }
    return getStackAvatarUris(images, undefined, memberIds);
  }, [memberIds, friends]);

  if (memberIds.length === 0) {
    return (
      <View style={styles.iconRing}>
        <Ionicons name="people-outline" size={21} color={ACCENT} />
      </View>
    );
  }

  if (stackUris.length === 1) {
    return (
      <View style={styles.singleWrap}>
        <ExpoImage
          source={{ uri: stackUris[0] }}
          style={styles.singlePhoto}
          cachePolicy="memory-disk"
          transition={120}
        />
      </View>
    );
  }

  return (
    <View style={styles.stackWrap}>
      <ExpoImage
        source={{ uri: stackUris[0] }}
        style={[styles.stackPhoto, styles.stackPhotoBack]}
        cachePolicy="memory-disk"
        transition={120}
      />
      <ExpoImage
        source={{ uri: stackUris[1] }}
        style={[styles.stackPhoto, styles.stackPhotoFront]}
        cachePolicy="memory-disk"
        transition={120}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  iconRing: {
    width: AVATAR_SLOT,
    height: AVATAR_SLOT,
    borderRadius: AVATAR_SLOT / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: SURFACE_MUTED,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
  },
  singleWrap: {
    width: AVATAR_SLOT,
    height: AVATAR_SLOT,
    alignItems: "center",
    justifyContent: "center",
  },
  singlePhoto: {
    width: AVATAR_SLOT,
    height: AVATAR_SLOT,
    borderRadius: AVATAR_SLOT / 2,
    borderWidth: 2,
    borderColor: BORDER_SOFT,
    backgroundColor: SURFACE_ELEVATED,
  },
  stackWrap: {
    width: AVATAR_SLOT,
    height: AVATAR_SLOT,
    position: "relative",
  },
  stackPhoto: {
    width: 34,
    height: 34,
    borderRadius: 17,
    position: "absolute",
    borderWidth: 2,
    borderColor: GROUP_SURFACE,
    backgroundColor: SURFACE_ELEVATED,
  },
  stackPhotoBack: {
    left: 0,
    top: 6,
    zIndex: 1,
  },
  stackPhotoFront: {
    left: 14,
    top: 12,
    zIndex: 2,
  },
});
