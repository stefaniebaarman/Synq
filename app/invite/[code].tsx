import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect, useLocalSearchParams } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { BG } from "../../constants/Variables";
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

  useEffect(() => {
    const normalized = String(inviteCode || "").trim();
    if (!normalized) return;
    AsyncStorage.setItem(PENDING_INVITE_CODE_KEY, normalized).catch(() => {});
  }, [inviteCode]);

  if (auth.currentUser) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <>
      <Redirect href="/(auth)/welcome" />
      <View style={styles.container}>
        <ActivityIndicator />
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
