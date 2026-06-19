import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect, useLocalSearchParams } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { BG } from "../../constants/Variables";
import { auth } from "../../src/lib/firebase";

const PENDING_INVITE_FROM_UID_KEY = "synq:pendingInviteFromUid";
const PENDING_INVITE_CODE_KEY = "synq:pendingInviteCode";

export default function InviteRoute() {
  const params = useLocalSearchParams<{
    inviteFrom?: string | string[];
    from?: string | string[];
    code?: string | string[];
  }>();

  const resolveParam = (value: string | string[] | undefined): string => {
    if (typeof value === "string") return value.trim();
    if (Array.isArray(value)) return String(value[0] || "").trim();
    return "";
  };

  useEffect(() => {
    const inviteFrom = resolveParam(params.inviteFrom) || resolveParam(params.from);
    const inviteCode = resolveParam(params.code);
    if (inviteFrom) {
      AsyncStorage.setItem(PENDING_INVITE_FROM_UID_KEY, inviteFrom).catch(() => {});
      return;
    }
    if (inviteCode) {
      AsyncStorage.setItem(PENDING_INVITE_CODE_KEY, inviteCode).catch(() => {});
    }
  }, [params.code, params.from, params.inviteFrom]);

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
