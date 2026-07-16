import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect, useLocalSearchParams, useRootNavigationState } from "expo-router";
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { BG } from "../../constants/Variables";
import { PageLoadSkeleton } from "@/src/components/loading/BrandSkeletons";
import { auth } from "../../src/lib/firebase";

const PENDING_INVITE_CODE_KEY = "synq:pendingInviteCode";

export default function InviteCodeRoute() {
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const codeParam = params.code;
  const inviteCode =
    typeof codeParam === "string"
      ? codeParam
      : Array.isArray(codeParam)
        ? codeParam[0]
        : "";
  const [persistReady, setPersistReady] = useState(false);
  const navReady = !!useRootNavigationState()?.key;

  useEffect(() => {
    const normalized = String(inviteCode || "").trim();
    if (!normalized) {
      setPersistReady(true);
      return;
    }
    let cancelled = false;
    AsyncStorage.setItem(PENDING_INVITE_CODE_KEY, normalized)
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setPersistReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [inviteCode]);

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
