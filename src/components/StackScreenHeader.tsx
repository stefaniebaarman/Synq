import BackButton from "@/src/components/BackButton";
import {
  BORDER,
  SPACE_3,
  SPACE_4,
  stackNavigationBackBtn,
  stackScreenHeaderTitle,
} from "@/constants/Variables";
import { router } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

const SIDE_SLOT_WIDTH = 40;

type Props = {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
};

export default function StackScreenHeader({ title, onBack, right }: Props) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <View style={styles.sideSlot}>
          <BackButton
            onPress={onBack ?? (() => router.back())}
            style={[stackNavigationBackBtn, styles.backButton]}
          />
        </View>

        <View style={styles.titleSlot} pointerEvents="none">
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>

        <View style={styles.sideSlotRight}>
          {right ? <View style={styles.right}>{right}</View> : null}
        </View>
      </View>
      <View style={styles.divider} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: "transparent",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: SPACE_3,
    paddingRight: SPACE_4,
    paddingTop: 4,
    paddingBottom: SPACE_3,
    minHeight: 44,
  },
  sideSlot: {
    width: SIDE_SLOT_WIDTH,
    alignItems: "flex-start",
    justifyContent: "center",
    zIndex: 1,
  },
  sideSlotRight: {
    minWidth: SIDE_SLOT_WIDTH,
    alignItems: "flex-end",
    justifyContent: "center",
    zIndex: 1,
  },
  backButton: {
    marginRight: 0,
  },
  titleSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACE_3,
  },
  title: {
    ...stackScreenHeaderTitle,
    textAlign: "center",
  },
  right: {
    alignSelf: "flex-end",
    minWidth: 32,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER,
    marginHorizontal: SPACE_4,
  },
});
