import {
  ACCENT,
  BG,
  BUTTON_RADIUS,
  MUTED2,
  ON_ACCENT_TEXT,
  SHEET_OVERLAY,
  TEXT,
  TYPE_BODY,
  TYPE_CAPTION,
  TYPE_SECTION,
  fonts,
} from "@/constants/Variables";
import CloseButton from "@/src/components/CloseButton";
import { FriendGroup } from "@/src/lib/friendGroups";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
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

function saveCtaLabel(changeCount: number): string {
  if (changeCount === 0) return "Save";
  if (changeCount === 1) return "Save change";
  return `Save changes (${changeCount})`;
}

export default function AddFriendToGroupSheet({
  visible,
  busy,
  groups,
  friendName,
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

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(24, insets.bottom) }]}>
          <View style={styles.header}>
            <Text style={styles.title}>Add to group</Text>
            <CloseButton onPress={handleClose} />
          </View>
          {sortedGroups.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Create a group from the Friends tab first.</Text>
            </View>
          ) : (
            <FlatList
              data={sortedGroups}
              keyExtractor={(item) => item.id}
              style={styles.list}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const checked = selected.has(item.id);
                return (
                  <TouchableOpacity
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
              }}
            />
          )}
          <TouchableOpacity
            style={[styles.cta, (changeCount === 0 || busy) && styles.ctaDisabled]}
            disabled={changeCount === 0 || busy}
            onPress={handleSave}
          >
            {busy ? (
              <ActivityIndicator color={ON_ACCENT_TEXT} />
            ) : (
              <Text style={styles.ctaText}>{saveCtaLabel(changeCount)}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: SHEET_OVERLAY,
  },
  sheet: {
    maxHeight: "88%",
    backgroundColor: BG,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  title: {
    fontFamily: fonts.medium,
    fontSize: TYPE_SECTION,
    color: TEXT,
  },
  subtitle: {
    fontFamily: fonts.book,
    fontSize: TYPE_BODY,
    color: MUTED2,
    marginBottom: 12,
  },
  list: {
    maxHeight: 340,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
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
    opacity: 0.45,
  },
  ctaText: {
    fontFamily: fonts.medium,
    fontSize: TYPE_BODY,
    color: ON_ACCENT_TEXT,
  },
});
