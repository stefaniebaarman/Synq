import {
  RADIUS_MD,
  RADIUS_LG,
  RADIUS_2XL,
  SURFACE_RAISED,
  SPACE_3,
  SPACE_4,
  SPACE_5,
} from "@/constants/Variables";
import React, { useEffect } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

export function SkeletonBlock({ style }: { style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (reduced) {
      pulse.value = 0.72;
      return;
    }
    pulse.value = withRepeat(
      withTiming(0.55, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [pulse, reduced]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  return <Animated.View style={[styles.block, animStyle, style]} />;
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
    <View style={styles.topSynqsRow} accessibilityLabel="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.topSynqItem}>
          <SkeletonBlock style={styles.topSynqAvatar} />
          <SkeletonBlock style={styles.topSynqName} />
        </View>
      ))}
    </View>
  );
}

/** Friend / plan / notification list rows. */
export function ListRowsSkeleton({
  count = 5,
  withAvatar = true,
}: {
  count?: number;
  withAvatar?: boolean;
}) {
  return (
    <View style={styles.listRows} accessibilityLabel="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.listRow}>
          {withAvatar ? <SkeletonBlock style={styles.listAvatar} /> : null}
          <View style={styles.listLines}>
            <SkeletonBlock style={styles.listTitle} />
            <SkeletonBlock style={styles.listMeta} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Compact plan cards (Upcoming / community plans). */
export function PlanCardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.planCards} accessibilityLabel="Loading plans">
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.planCard}>
          <SkeletonBlock style={styles.planDate} />
          <View style={styles.planBody}>
            <SkeletonBlock style={styles.planTitle} />
            <SkeletonBlock style={styles.planMeta} />
          </View>
          <SkeletonBlock style={styles.planPill} />
        </View>
      ))}
    </View>
  );
}

/** Centered page placeholder (profile, group detail, deep links). */
export function PageLoadSkeleton() {
  return (
    <View style={styles.page} accessibilityLabel="Loading">
      <SkeletonBlock style={styles.pageHero} />
      <SkeletonBlock style={styles.pageLineWide} />
      <SkeletonBlock style={styles.pageLineMid} />
      <View style={styles.pageGap} />
      <ListRowsSkeleton count={4} />
    </View>
  );
}

/** Profile header + body. */
export function ProfileSkeleton() {
  return (
    <View style={styles.profile} accessibilityLabel="Loading profile">
      <SkeletonBlock style={styles.profileAvatar} />
      <SkeletonBlock style={styles.profileName} />
      <SkeletonBlock style={styles.profileMeta} />
      <View style={styles.pageGap} />
      <ListRowsSkeleton count={3} withAvatar={false} />
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
    borderRadius: RADIUS_2XL,
    marginBottom: 8,
  },
  topSynqName: {
    width: 48,
    height: 10,
    borderRadius: 5,
  },
  listRows: {
    width: "100%",
    gap: SPACE_4,
    paddingHorizontal: SPACE_5,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE_3,
  },
  listAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  listLines: {
    flex: 1,
    gap: 8,
  },
  listTitle: {
    width: "58%",
    height: 12,
    borderRadius: 6,
  },
  listMeta: {
    width: "38%",
    height: 10,
    borderRadius: 5,
  },
  planCards: {
    width: "100%",
    gap: SPACE_3,
    paddingHorizontal: SPACE_5,
  },
  planCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE_3,
    paddingVertical: SPACE_3,
  },
  planDate: {
    width: 44,
    height: 56,
    borderRadius: RADIUS_MD,
  },
  planBody: {
    flex: 1,
    gap: 8,
  },
  planTitle: {
    width: "70%",
    height: 12,
    borderRadius: 6,
  },
  planMeta: {
    width: "45%",
    height: 10,
    borderRadius: 5,
  },
  planPill: {
    width: 72,
    height: 28,
    borderRadius: RADIUS_LG,
  },
  page: {
    flex: 1,
    width: "100%",
    paddingTop: SPACE_5,
    alignItems: "stretch",
  },
  pageHero: {
    alignSelf: "center",
    width: 88,
    height: 88,
    borderRadius: 44,
    marginBottom: SPACE_4,
  },
  pageLineWide: {
    alignSelf: "center",
    width: "42%",
    height: 14,
    borderRadius: 7,
    marginBottom: 10,
  },
  pageLineMid: {
    alignSelf: "center",
    width: "28%",
    height: 10,
    borderRadius: 5,
    marginBottom: SPACE_5,
  },
  pageGap: {
    height: SPACE_4,
  },
  profile: {
    flex: 1,
    width: "100%",
    paddingTop: SPACE_5,
    alignItems: "center",
  },
  profileAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginBottom: SPACE_4,
  },
  profileName: {
    width: 140,
    height: 16,
    borderRadius: 8,
    marginBottom: 10,
  },
  profileMeta: {
    width: 100,
    height: 10,
    borderRadius: 5,
  },
});
