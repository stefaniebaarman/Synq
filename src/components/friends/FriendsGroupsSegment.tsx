import {
  ACCENT,
  heroTitleText,
  MUTED2,
  MUTED3,
  TYPE_SUBHEAD,
  fonts,
} from "@/constants/Variables";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export type FriendsTabMode = "friends" | "groups";

type Props = {
  mode: FriendsTabMode;
  onChange: (mode: FriendsTabMode) => void;
};

/**
 * Masthead-style section switcher: Friends | Groups in the tab header.
 * Active section uses accent; inactive is muted (no pill chrome).
 */
export default function FriendsGroupsHeaderTitle({ mode, onChange }: Props) {
  return (
    <View style={styles.row} accessibilityRole="tablist">
      <Pressable
        onPress={() => onChange("friends")}
        hitSlop={{ top: 8, bottom: 8, right: 4 }}
        accessibilityRole="tab"
        accessibilityState={{ selected: mode === "friends" }}
        accessibilityLabel="Friends"
      >
        <Text style={[styles.title, mode === "friends" ? styles.titleActive : styles.titleInactive]}>
          Friends
        </Text>
      </Pressable>
      <Text style={styles.divider} accessibilityElementsHidden>
        |
      </Text>
      <Pressable
        onPress={() => onChange("groups")}
        hitSlop={{ top: 8, bottom: 8, left: 4 }}
        accessibilityRole="tab"
        accessibilityState={{ selected: mode === "groups" }}
        accessibilityLabel="Groups"
      >
        <Text style={[styles.title, mode === "groups" ? styles.titleActive : styles.titleInactive]}>
          Groups
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minHeight: 28,
    gap: 8,
  },
  title: {
    ...heroTitleText,
    lineHeight: 26,
    includeFontPadding: false,
  },
  titleActive: {
    color: ACCENT,
  },
  titleInactive: {
    color: MUTED2,
    fontFamily: fonts.medium,
    opacity: 0.92,
  },
  divider: {
    fontFamily: fonts.book,
    fontSize: TYPE_SUBHEAD,
    lineHeight: 26,
    color: MUTED3,
    marginTop: 1,
  },
});
