import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect, useLocalSearchParams, useRootNavigationState } from "expo-router";
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { BG } from "@/constants/Variables";
import { PageLoadSkeleton } from "@/src/components/loading/BrandSkeletons";
import {
  normalizeAmbassadorCode,
  PENDING_AMBASSADOR_CODE_KEY,
  PENDING_AMBASSADOR_METHOD_KEY,
} from "@/src/lib/ambassadorReferral";
import { auth } from "@/src/lib/firebase";

export default function AmbassadorCodeRoute() {
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const codeParam = params.code;
  const rawCode =
    typeof codeParam === "string"
      ? codeParam
      : Array.isArray(codeParam)
        ? codeParam[0]
        : "";
  const [persistReady, setPersistReady] = useState(false);
  const navReady = !!useRootNavigationState()?.key;

  useEffect(() => {
    const normalized = normalizeAmbassadorCode(rawCode);
    if (!normalized) {
      setPersistReady(true);
      return;
    }
    let cancelled = false;
    AsyncStorage.multiSet([
      [PENDING_AMBASSADOR_CODE_KEY, normalized],
      [PENDING_AMBASSADOR_METHOD_KEY, "universal_link"],
    ])
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setPersistReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [rawCode]);

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
