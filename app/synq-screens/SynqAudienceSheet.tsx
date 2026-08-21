import { DIALOG_ANIMATION } from "@/constants/sheetStyles";
import {
  ACCENT,
  ACCENT_BORDER,
  ACCENT_FILL_FAINT,
  BORDER,
  MUTED2,
  MUTED3,
  OVERLAY_NEAR_FULL,
  SHEET_SURFACE,
  SPACE_4,
  SPACE_5,
  SURFACE_FAINT,
  TEXT,
  TYPE_BODY,
  TYPE_BUTTON,
  TYPE_CAPTION,
  fonts,
  sheetTitleText,
  synqOutlineAddBtn,
  synqOutlineAddBtnText
} from "@/constants/Variables";
import type { FriendGroup } from "@/src/lib/friendGroups";
import type { SynqAudienceSelection } from "@/src/lib/synqBroadcast";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

type Props = {
  visible: boolean;
  groups: FriendGroup[];
  selection: SynqAudienceSelection;
  onChangeSelection: (next: SynqAudienceSelection) => void;
  onClose: () => void;
};

function peopleLabel(count: number) {
  return `${count} ${count === 1 ? "person" : "people"}`;
}

export default function SynqAudienceSheet({
  visible,
  groups,
  selection,
  onChangeSelection,
  onClose,
}: Props) {
  const [draft, setDraft] = useState<SynqAudienceSelection>(selection);

  useEffect(() => {
    if (!visible) return;
    setDraft(selection);
  }, [visible, selection]);

  const handleDone = () => {
    onChangeSelection(draft);
    onClose();
  };

  const allSelected = draft.mode === "all";

  return (
    <Modal visible={visible} transparent animationType={DIALOG_ANIMATION}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.panel}>
              <Text style={styles.title}>Sharing with</Text>
              <Text style={styles.subtitle}>Pick a circle to be visible to</Text>

              <ScrollView
                style={styles.listScroll}
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                <Pressable
                  onPress={() => setDraft({ mode: "all", groupIds: [] })}
                  style={({ pressed }) => [
                    styles.row,
                    allSelected && styles.rowSelected,
                    pressed && styles.rowPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: allSelected }}
                  accessibilityLabel="All friends"
                >
                  <View style={styles.rowIcon}>
                    <Ionicons name="people-outline" size={20} color={TEXT} />
                  </View>
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowLabel}>All friends</Text>
                    <Text style={styles.rowMeta}>Everyone you're friends with</Text>
                  </View>
                  {allSelected ? (
                    <Ionicons name="checkmark-circle" size={22} color={ACCENT} />
                  ) : (
                    <View style={styles.checkPlaceholder} />
                  )}
                </Pressable>

                {groups.map((group) => {
                  const count = group.memberIds.length;
                  const disabled = count === 0;
                  const selected =
                    draft.mode === "groups" && draft.groupIds.includes(group.id);
                  return (
                    <Pressable
                      key={group.id}
                      onPress={() => {
                        if (disabled) return;
                        setDraft({ mode: "groups", groupIds: [group.id] });
                      }}
                      disabled={disabled}
                      style={({ pressed }) => [
                        styles.row,
                        selected && styles.rowSelected,
                        disabled && styles.rowDisabled,
                        pressed && !disabled && styles.rowPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected, disabled }}
                      accessibilityLabel={group.name}
                    >
                      <View style={styles.rowIcon}>
                        <Ionicons name="people-outline" size={20} color={TEXT} />
                      </View>
                      <View style={styles.rowCopy}>
                        <Text style={styles.rowLabel} numberOfLines={1}>
                          {group.name}
                        </Text>
                        <Text style={styles.rowMeta}>{peopleLabel(count)}</Text>
                      </View>
                      {selected ? (
                        <Ionicons name="checkmark-circle" size={22} color={ACCENT} />
                      ) : (
                        <View style={styles.checkPlaceholder} />
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>

              <TouchableOpacity
                style={[synqOutlineAddBtn, styles.doneBtn]}
                onPress={handleDone}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Done"
              >
                <Text style={synqOutlineAddBtnText}>Done</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onClose}
                style={styles.cancelBtn}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: OVERLAY_NEAR_FULL,
    justifyContent: "center",
    alignItems: "center",
    padding: 25,
    paddingBottom: 72,
  },
  panel: {
    width: "100%",
    backgroundColor: SHEET_SURFACE,
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 22,
    alignItems: "stretch",
    maxHeight: "78%",
  },
  title: {
    ...sheetTitleText,
  },
  subtitle: {
    color: MUTED2,
    fontFamily: fonts.book,
    fontSize: TYPE_CAPTION,
    marginTop: 4,
    marginBottom: SPACE_4,
  },
  listScroll: {
    flexGrow: 0,
  },
  list: {
    gap: 10,
    paddingBottom: SPACE_4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE_FAINT,
  },
  rowSelected: {
    borderColor: ACCENT_BORDER,
    backgroundColor: ACCENT_FILL_FAINT,
  },
  rowPressed: {
    opacity: 0.85,
  },
  rowDisabled: {
    opacity: 0.4,
  },
  rowIcon: {
    width: 28,
    alignItems: "center",
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowLabel: {
    color: TEXT,
    fontFamily: fonts.medium,
    fontSize: TYPE_BODY,
  },
  rowMeta: {
    color: MUTED3,
    fontFamily: fonts.book,
    fontSize: TYPE_CAPTION,
    marginTop: 2,
  },
  checkPlaceholder: {
    width: 22,
    height: 22,
  },
  doneBtn: {
    marginTop: SPACE_5,
    alignSelf: "center",
  },
  cancelBtn: {
    marginTop: 14,
    alignItems: "center",
    paddingVertical: 6,
  },
  cancelText: {
    color: MUTED2,
    fontFamily: fonts.medium,
    fontSize: TYPE_BUTTON,
  },
});
