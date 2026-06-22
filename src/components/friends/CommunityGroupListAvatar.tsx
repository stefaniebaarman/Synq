import {
  ACCENT,
  BORDER_SOFT,
  SURFACE_ELEVATED,
} from "@/constants/Variables";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import React from "react";
import { StyleSheet, View } from "react-native";

const AVATAR_SIZE = 48;

type Props = {
  coverPhotoUrl?: string;
  coverPhotoThumbUrl?: string;
};

export default function CommunityGroupListAvatar({
  coverPhotoUrl,
  coverPhotoThumbUrl,
}: Props) {
  const cover = coverPhotoThumbUrl?.trim() || coverPhotoUrl?.trim();

  if (cover) {
    return (
      <View style={styles.wrap}>
        <ExpoImage
          source={{ uri: cover }}
          style={styles.coverPhoto}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={120}
        />
      </View>
    );
  }

  return (
    <View style={styles.iconRing}>
      <Ionicons name="people" size={22} color={ACCENT} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  coverPhoto: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2,
    borderColor: BORDER_SOFT,
    backgroundColor: SURFACE_ELEVATED,
  },
  iconRing: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,255,133,0.1)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,255,133,0.22)",
  },
});
