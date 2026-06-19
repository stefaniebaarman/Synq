import {
  ACCENT,
  BG,
  TYPE_CAPTION,
  fonts,
} from "@/constants/Variables";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function useNetworkOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const apply = (state: NetInfoState) => {
      setOnline(state.isConnected !== false && state.isInternetReachable !== false);
    };
    const unsub = NetInfo.addEventListener(apply);
    void NetInfo.fetch().then(apply);
    return unsub;
  }, []);

  return online;
}

export default function OfflineBanner() {
  const online = useNetworkOnline();
  const insets = useSafeAreaInsets();

  if (online) return null;

  return (
    <View
      style={[styles.banner, { paddingTop: Math.max(insets.top, 8) }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.text}>You&apos;re offline. Some actions may not work.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    backgroundColor: ACCENT,
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
  text: {
    color: BG,
    fontSize: TYPE_CAPTION,
    fontFamily: fonts.heavy,
    textAlign: "center",
  },
});
