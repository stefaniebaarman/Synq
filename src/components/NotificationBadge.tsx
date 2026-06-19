import {
  ACCENT,
  BG,
  DESTRUCTIVE,
  TEXT,
  TYPE_FINE,
  fonts,
} from "@/constants/Variables";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

type Props =
  | { variant: "count"; count: number }
  | { variant: "dot" };

export default function NotificationBadge(props: Props) {
  if (props.variant === "dot") {
    return <View style={styles.dot} />;
  }
  const display = props.count > 99 ? "99+" : String(props.count);
  return (
    <View style={styles.countBadge}>
      <Text style={styles.countText}>{display}</Text>
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
  countText: {
    color: TEXT,
    fontSize: TYPE_FINE,
    fontFamily: fonts.black,
  },
});
