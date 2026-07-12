import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { ACCENT, BG } from "@/constants/Variables";
import { auth } from "@/src/lib/firebase";

const PENDING_PROFILE_SHARE_CODE_KEY = "synq:pendingProfileShareCode";

export default function ProfileShareCodeRoute() {
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const codeParam = params.code;
  const inviteCode =
    typeof codeParam === "string"
      ? codeParam
      : Array.isArray(codeParam)
        ? codeParam[0]
        : "";
  const [persistReady, setPersistReady] = useState(false);

  useEffect(() => {
    const normalized = String(inviteCode || "")
      .trim()
      .toUpperCase();
    if (!normalized) {
      setPersistReady(true);
      return;
    }
    let cancelled = false;
    AsyncStorage.setItem(PENDING_PROFILE_SHARE_CODE_KEY, normalized)
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setPersistReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [inviteCode]);

  if (!persistReady) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={ACCENT} />
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
        <ActivityIndicator color={ACCENT} />
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
