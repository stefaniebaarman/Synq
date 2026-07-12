import {
  RADIUS_MD,
  SURFACE_RAISED,
} from "@/constants/Variables";
import React from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";

export function SkeletonBlock({ style }: { style?: ViewStyle }) {
  return <View style={[styles.block, style]} />;
}

/** Mirrors inactive Synq home while session hydrates. */
export function SynqBootSkeleton() {
  return (
    <View style={styles.boot} accessibilityLabel="Loading Synq">
      <SkeletonBlock style={styles.bootMood} />
      <SkeletonBlock style={styles.bootOrb} />
      <SkeletonBlock style={styles.bootCta} />
    </View>
  );
}

/** Top Synqs row placeholder on Me tab. */
export function TopSynqsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.topSynqsRow}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.topSynqItem}>
          <SkeletonBlock style={styles.topSynqAvatar} />
          <SkeletonBlock style={styles.topSynqName} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: SURFACE_RAISED,
    borderRadius: 8,
  },
  boot: {
    alignItems: "center",
    width: "100%",
    maxWidth: 320,
    paddingHorizontal: 22,
  },
  bootMood: {
    width: "100%",
    height: 44,
    borderRadius: RADIUS_MD,
    marginBottom: 18,
  },
  bootOrb: {
    width: 220,
    height: 220,
    borderRadius: 110,
    marginBottom: 12,
  },
  bootCta: {
    width: 148,
    height: 12,
    borderRadius: 6,
  },
  topSynqsRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    gap: 14,
  },
  topSynqItem: {
    alignItems: "center",
    width: 72,
  },
  topSynqAvatar: {
    width: 55,
    height: 55,
    borderRadius: 28,
    marginBottom: 8,
  },
  topSynqName: {
    width: 48,
    height: 10,
    borderRadius: 5,
  },
});
