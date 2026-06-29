import {
  ACCENT,
  ACCENT_FILL_SUBTLE,
  ACCENT_GRADIENT_END,
  ACCENT_GRADIENT_START,
  BG,
  BORDER_HAIRLINE,
  BORDER_SOFT,
  DIVIDER,
  FRIENDS_BORDER,
  GROUP_BORDER,
  SHARE_GRADIENT_ACCENT,
  SHARE_GRADIENT_START,
  SURFACE_WELL,
  TYPE_CTA,
  fonts,
  profileLocationText,
  profileNameText,
} from "@/constants/Variables";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

export const PROFILE_SHARE_CARD_WIDTH = 320;
export const PROFILE_SHARE_CARD_HEIGHT = 380;

export type ProfileShareCardProps = {
  displayName: string;
  avatarUri: string;
  location?: string | null;
  onAvatarLoad?: () => void;
};

export default function ProfileShareCard({
  displayName,
  avatarUri,
  location,
  onAvatarLoad,
}: ProfileShareCardProps) {
  const name = displayName.trim() || "Synq friend";

  return (
    <View style={styles.outer}>
      <LinearGradient
        colors={[SHARE_GRADIENT_START, BG, SHARE_GRADIENT_ACCENT, BG]}
        locations={[0, 0.38, 0.72, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.baseFill}
      />
      <LinearGradient
        colors={[ACCENT_GRADIENT_START, ACCENT_GRADIENT_END, "transparent"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.55 }}
        style={styles.accentWash}
      />
      <LinearGradient
        colors={["transparent", FRIENDS_BORDER, "transparent"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.sheen}
      />
      <View style={styles.innerBorder} />

      <View style={styles.content}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatarHalo} />
          <View style={styles.avatarRingOuter} collapsable={false}>
            <View style={styles.avatarRingInner} collapsable={false}>
              <ExpoImage
                source={{ uri: avatarUri }}
                style={styles.avatar}
                cachePolicy="memory-disk"
                contentFit="cover"
                transition={0}
                recyclingKey={avatarUri}
                onLoad={onAvatarLoad}
                onError={onAvatarLoad}
              />
            </View>
          </View>
        </View>

        <Text style={styles.name} numberOfLines={2}>
          {name}
        </Text>

        {location ? (
          <Text style={styles.location} numberOfLines={1}>
            {location}
          </Text>
        ) : null}

        <View style={styles.divider} />

        <Text style={styles.tagline}>Join me on Synq!</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: PROFILE_SHARE_CARD_WIDTH,
    height: PROFILE_SHARE_CARD_HEIGHT,
    borderRadius: 30,
    overflow: "hidden",
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: BORDER_SOFT,
  },
  baseFill: {
    ...StyleSheet.absoluteFillObject,
  },
  accentWash: {
    ...StyleSheet.absoluteFillObject,
  },
  sheen: {
    ...StyleSheet.absoluteFillObject,
  },
  innerBorder: {
    ...StyleSheet.absoluteFillObject,
    margin: 1,
    borderRadius: 29,
    borderWidth: 1,
    borderColor: GROUP_BORDER,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingVertical: 32,
  },
  avatarWrap: {
    width: 136,
    height: 136,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },
  avatarHalo: {
    position: "absolute",
    width: 136,
    height: 136,
    borderRadius: 68,
    backgroundColor: ACCENT_FILL_SUBTLE,
  },
  avatarRingOuter: {
    width: 124,
    height: 124,
    borderRadius: 62,
    padding: 1.5,
    backgroundColor: DIVIDER,
  },
  avatarRingInner: {
    flex: 1,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: ACCENT,
    overflow: "hidden",
    backgroundColor: SURFACE_WELL,
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
  name: {
    ...profileNameText,
    lineHeight: 32,
    textAlign: "center",
    letterSpacing: 0.2,
    maxWidth: "100%",
  },
  location: {
    ...profileLocationText,
    textAlign: "center",
    marginTop: 6,
    maxWidth: "100%",
  },
  divider: {
    width: 48,
    height: 1,
    backgroundColor: BORDER_HAIRLINE,
    marginTop: 22,
    marginBottom: 18,
  },
  tagline: {
    color: ACCENT,
    fontFamily: fonts.heavy,
    fontSize: TYPE_CTA,
    lineHeight: 24,
    textAlign: "center",
    letterSpacing: 0.3,
  },
});
