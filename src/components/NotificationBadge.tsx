import {
  ACCENT,
  BG,
  DESTRUCTIVE,
  ON_ACCENT_TEXT,
  TEXT,
  TYPE_FINE,
  fonts,
} from "@/constants/Variables";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

type Props =
  | { variant: "count"; count: number; tone?: "destructive" | "accent" }
  | { variant: "dot" };

export default function NotificationBadge(props: Props) {
  if (props.variant === "dot") {
    return <View style={styles.dot} />;
  }
  const display = props.count > 99 ? "99+" : String(props.count);
  const accent = props.tone === "accent";
  return (
    <View style={[styles.countBadge, accent && styles.countBadgeAccent]}>
      <Text style={[styles.countText, accent && styles.countTextAccent]}>
        {display}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: ACCENT,
    borderWidth: 2,
    borderColor: BG,
  },
  countBadge: {
    position: "absolute",
    right: -4,
    top: -4,
    backgroundColor: DESTRUCTIVE,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: BG,
  },
  countBadgeAccent: {
    backgroundColor: ACCENT,
  },
  countText: {
    color: TEXT,
    fontSize: TYPE_FINE,
    fontFamily: fonts.heavy,
  },
  countTextAccent: {
    color: ON_ACCENT_TEXT,
  },
});
