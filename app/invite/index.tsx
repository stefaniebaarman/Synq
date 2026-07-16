import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect, useLocalSearchParams, useRootNavigationState } from "expo-router";
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { BG } from "../../constants/Variables";
import { PageLoadSkeleton } from "@/src/components/loading/BrandSkeletons";
import { auth } from "../../src/lib/firebase";

const PENDING_INVITE_FROM_UID_KEY = "synq:pendingInviteFromUid";
const PENDING_INVITE_CODE_KEY = "synq:pendingInviteCode";

export default function InviteRoute() {
  const params = useLocalSearchParams<{
    inviteFrom?: string | string[];
    from?: string | string[];
    code?: string | string[];
  }>();
  const [persistReady, setPersistReady] = useState(false);
  const navReady = !!useRootNavigationState()?.key;

  const resolveParam = (value: string | string[] | undefined): string => {
    if (typeof value === "string") return value.trim();
    if (Array.isArray(value)) return String(value[0] || "").trim();
    return "";
  };

  useEffect(() => {
    const inviteFrom = resolveParam(params.inviteFrom) || resolveParam(params.from);
    const inviteCode = resolveParam(params.code);
    if (!inviteFrom && !inviteCode) {
      setPersistReady(true);
      return;
    }

    let cancelled = false;
    const persist = async () => {
      try {
        if (inviteFrom) {
          await AsyncStorage.setItem(PENDING_INVITE_FROM_UID_KEY, inviteFrom);
        }
        if (inviteCode) {
          await AsyncStorage.setItem(PENDING_INVITE_CODE_KEY, inviteCode);
        }
      } catch {
        // Root layout will still attempt accept if keys were written earlier.
      } finally {
        if (!cancelled) setPersistReady(true);
      }
    };
    void persist();
    return () => {
      cancelled = true;
    };
  }, [params.code, params.from, params.inviteFrom]);

  if (!persistReady || !navReady) {
    return (
      <View style={styles.container}>
        <PageLoadSkeleton />
      </View>
    );
  }

  if (auth.currentUser) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <>
      <Redirect href="/(auth)/welcome" />
      <View style={styles.container}>
        <PageLoadSkeleton />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG,
    alignItems: "center",
    justifyContent: "center",
  },
});
