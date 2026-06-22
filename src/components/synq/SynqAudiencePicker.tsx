import {
  ACCENT,
  BORDER,
  MUTED2,
  MUTED3,
  SPACE_4,
  SURFACE_FAINT,
  TEXT,
  TYPE_BODY,
  TYPE_BUTTON,
  fonts,
} from "@/constants/Variables";
import type { FriendGroup } from "@/src/lib/friendGroups";
import type { SynqAudienceSelection } from "@/src/lib/synqBroadcast";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  groups: FriendGroup[];
  selection: SynqAudienceSelection;
  onChangeSelection: (next: SynqAudienceSelection) => void;
  /** Tighter rows for bottom-sheet modals. */
  compact?: boolean;
};

type RowProps = {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
};

function Row({
  label,
  selected,
  disabled,
  onPress,
  isFirst = false,
  compact = false,
}: RowProps & { isFirst?: boolean; compact?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.row,
        compact && styles.rowCompact,
        !isFirst && styles.rowBorder,
        selected && styles.rowSelected,
        disabled && styles.rowDisabled,
        pressed && !disabled && styles.rowPressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: Boolean(disabled) }}
      accessibilityLabel={label}
    >
      <Text
        style={[
          styles.rowLabel,
          compact && styles.rowLabelCompact,
          disabled && styles.rowLabelDisabled,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {selected ? (
        <Ionicons name="checkmark" size={compact ? 18 : 20} color={ACCENT} />
      ) : (
        <View style={[styles.checkPlaceholder, compact && styles.checkPlaceholderCompact]} />
      )}
    </Pressable>
  );
}

export default function SynqAudiencePicker({
  groups,
  selection,
  onChangeSelection,
  compact = false,
}: Props) {
  const selectAllFriends = () => {
    onChangeSelection({ mode: "all", groupIds: [] });
  };

  const toggleGroup = (groupId: string, memberCount: number) => {
    if (memberCount === 0) return;
    if (selection.mode === "all") {
      onChangeSelection({ mode: "groups", groupIds: [groupId] });
      return;
    }
    const has = selection.groupIds.includes(groupId);
    const nextIds = has
      ? selection.groupIds.filter((id) => id !== groupId)
      : [...selection.groupIds, groupId];
    if (nextIds.length === 0) {
      onChangeSelection({ mode: "all", groupIds: [] });
      return;
    }
    onChangeSelection({ mode: "groups", groupIds: nextIds });
  };

  const allSelected = selection.mode === "all";

  return (
    <View style={styles.wrap}>
      <Row
        label="All friends"
        selected={allSelected}
        onPress={selectAllFriends}
        isFirst
        compact={compact}
      />
      {groups.map((group) => {
        const count = group.memberIds.length;
        const disabled = count === 0;
        const selected =
          selection.mode === "groups" && selection.groupIds.includes(group.id);
        return (
          <Row
            key={group.id}
            label={group.name}
            selected={selected}
            disabled={disabled}
            onPress={() => toggleGroup(group.id, count)}
            compact={compact}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: SPACE_4,
    minHeight: 48,
  },
  rowCompact: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    minHeight: 42,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
  },
  rowSelected: {
    backgroundColor: "rgba(0,255,133,0.04)",
  },
  rowPressed: {
    backgroundColor: SURFACE_FAINT,
  },
  rowDisabled: {
    opacity: 0.4,
  },
  rowLabel: {
    flex: 1,
    color: TEXT,
    fontSize: TYPE_BODY,
    fontFamily: fonts.medium,
    marginRight: 12,
  },
  rowLabelCompact: {
    fontSize: TYPE_BUTTON,
    marginRight: 10,
  },
  rowLabelDisabled: {
    color: MUTED2,
  },
  checkPlaceholder: {
    width: 20,
    height: 20,
  },
  checkPlaceholderCompact: {
    width: 18,
    height: 18,
  },
});
