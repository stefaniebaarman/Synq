import { BG } from "@/constants/Variables";
import { Platform, StatusBar, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Dark status bar + top fill on Android edge-to-edge (backgroundColor on StatusBar
 * is ignored when the activity is edge-to-edge).
 */
export default function SynqStatusBar() {
  const insets = useSafeAreaInsets();
  const topFill =
    Platform.OS === "android"
      ? Math.max(insets.top, StatusBar.currentHeight ?? 0)
      : 0;

  return (
    <>
      <StatusBar
        barStyle="light-content"
        backgroundColor={BG}
        translucent={Platform.OS === "android"}
      />
      {topFill > 0 ? (
        <View
          pointerEvents="none"
          style={[styles.topFill, { height: topFill }]}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  topFill: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: BG,
    zIndex: 10000,
  },
});
