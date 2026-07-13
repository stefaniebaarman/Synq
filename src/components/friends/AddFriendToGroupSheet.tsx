import {
  ACCENT,
  BG,
  BUTTON_RADIUS,
  DISABLED_ACCENT,
  MUTED2,
  ON_ACCENT_TEXT,
  RADIUS_MD,
  TEXT,
  TYPE_BODY,
  TYPE_CAPTION,
  fonts,
  sheetHeaderTitleText,
} from "@/constants/Variables";
import CloseButton from "@/src/components/CloseButton";
import SpringBottomSheet from "@/src/components/sheets/SpringBottomSheet";
import { FriendGroup } from "@/src/lib/friendGroups";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  visible: boolean;
  busy?: boolean;
  groups: FriendGroup[];
  friendName: string;
  memberId: string;
  onClose: () => void;
  onSave: (changes: {
    addedGroupIds: string[];
    removedGroupIds: string[];
  }) => void | Promise<void>;
};

/** Row: 10+10 padding + ~24 icon/text line. */
const ROW_HEIGHT = 44;
const LIST_MAX_ROWS = 8;
const LIST_MAX_HEIGHT = ROW_HEIGHT * LIST_MAX_ROWS;

function saveCtaLabel(changeCount: number): string {
  if (changeCount === 0) return "Save";
  if (changeCount === 1) return "Save change";
  return `Save changes (${changeCount})`;
}

export default function AddFriendToGroupSheet({
  visible,
  busy,
  groups,
  friendName: _friendName,
  memberId,
  onClose,
  onSave,
}: Props) {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const memberGroupIds = useMemo(
    () => new Set(groups.filter((g) => g.memberIds.includes(memberId)).map((g) => g.id)),
    [groups, memberId]
  );

  useEffect(() => {
    if (visible) {
      setSelected(new Set(memberGroupIds));
    }
  }, [visible, memberGroupIds]);

  const sortedGroups = useMemo(
    () => [...groups].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [groups]
  );

  const listHeight = Math.min(LIST_MAX_HEIGHT, Math.max(ROW_HEIGHT, sortedGroups.length * ROW_HEIGHT));
  const needsScroll = sortedGroups.length > LIST_MAX_ROWS;

  const { addedGroupIds, removedGroupIds, changeCount } = useMemo(() => {
    const added = [...selected].filter((id) => !memberGroupIds.has(id));
    const removed = [...memberGroupIds].filter((id) => !selected.has(id));
    return {
      addedGroupIds: added,
      removedGroupIds: removed,
      changeCount: added.length + removed.length,
    };
  }, [selected, memberGroupIds]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleClose = () => {
    setSelected(new Set(memberGroupIds));
    onClose();
  };

  const handleSave = () => {
    if (changeCount === 0 || busy) return;
    void onSave({ addedGroupIds, removedGroupIds });
  };

  const rows = sortedGroups.map((item) => {
    const checked = selected.has(item.id);
    return (
      <TouchableOpacity
        key={item.id}
        style={styles.row}
        onPress={() => toggle(item.id)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
      >
        <Text style={styles.rowName} numberOfLines={1}>
          {item.name}
        </Text>
        <Ionicons
          name={checked ? "checkbox" : "square-outline"}
          size={22}
          color={checked ? ACCENT : MUTED2}
        />
      </TouchableOpacity>
    );
  });

  return (
    <SpringBottomSheet
      visible={visible}
      onClose={handleClose}
      cardStyle={[styles.sheet, { paddingBottom: Math.max(24, insets.bottom) }]}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Add friend to circle</Text>
        <CloseButton onPress={handleClose} />
      </View>
      {sortedGroups.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Create a circle from the Friends tab first.</Text>
        </View>
      ) : needsScroll ? (
        <View style={{ height: listHeight }}>
          <ScrollView
            style={styles.listScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            nestedScrollEnabled
          >
            {rows}
          </ScrollView>
        </View>
      ) : (
        <View style={{ height: listHeight }}>{rows}</View>
      )}
      <TouchableOpacity
        style={[styles.cta, (changeCount === 0 || busy) && styles.ctaDisabled]}
        disabled={changeCount === 0 || busy}
        onPress={handleSave}
      >
        <Text style={styles.ctaText}>
          {saveCtaLabel(changeCount)}
        </Text>
      </TouchableOpacity>
    </SpringBottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: BG,
    borderRadius: RADIUS_MD,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  title: {
    ...sheetHeaderTitleText,
  },
  listScroll: {
    flex: 1,
  },
  row: {
    height: ROW_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowName: {
    flex: 1,
    fontFamily: fonts.book,
    fontSize: TYPE_BODY,
    color: TEXT,
  },
  empty: {
    paddingVertical: 24,
    alignItems: "center",
  },
  emptyText: {
    fontFamily: fonts.book,
    fontSize: TYPE_CAPTION,
    color: MUTED2,
    textAlign: "center",
    lineHeight: 18,
  },
  cta: {
    alignSelf: "center",
    width: "62%",
    marginTop: 12,
    minHeight: 48,
    borderRadius: BUTTON_RADIUS,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaDisabled: {
    backgroundColor: DISABLED_ACCENT,
  },
  ctaText: {
    fontFamily: fonts.medium,
    fontSize: TYPE_BODY,
    color: ON_ACCENT_TEXT,
  },
});
