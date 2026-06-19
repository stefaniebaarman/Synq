import SynqAudiencePicker from "@/src/components/synq/SynqAudiencePicker";
import {
  ACCENT,
  BORDER,
  BUTTON_RADIUS,
  MUTED2,
  SHEET_OVERLAY,
  SHEET_SURFACE,
  SPACE_3,
  SPACE_4,
  TEXT,
  TYPE_BODY,
  fonts,
} from "@/constants/Variables";
import type { FriendGroup } from "@/src/lib/friendGroups";
import type { SynqAudienceSelection } from "@/src/lib/synqBroadcast";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function audienceSelectionEqual(
  a: SynqAudienceSelection,
  b: SynqAudienceSelection
): boolean {
  if (a.mode !== b.mode) return false;
  if (a.mode === "all") return true;
  const idsA = [...a.groupIds].sort();
  const idsB = [...b.groupIds].sort();
  if (idsA.length !== idsB.length) return false;
  return idsA.every((id, index) => id === idsB[index]);
}

type Props = {
  visible: boolean;
  groups: FriendGroup[];
  initialSelection: SynqAudienceSelection;
  onClose: () => void;
  onSave: (selection: SynqAudienceSelection) => Promise<void>;
};

export default function ChangeSynqAudienceModal({
  visible,
  groups,
  initialSelection,
  onClose,
  onSave,
}: Props) {
  const insets = useSafeAreaInsets();
  const [selection, setSelection] = useState<SynqAudienceSelection>(initialSelection);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setSelection(initialSelection);
  }, [visible, initialSelection]);

  const selectionDirty = useMemo(
    () => !audienceSelectionEqual(selection, initialSelection),
    [initialSelection, selection]
  );

  const handleSave = async () => {
    if (!selectionDirty || saving) return;
    setSaving(true);
    try {
      await onSave(selection);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityLabel="Close change audience"
        />
        <View style={[styles.sheetGroup, { paddingBottom: insets.bottom + SPACE_3 }]}>
          <View style={styles.sheetCard}>
            <View style={styles.headerRow}>
              <Text style={styles.sheetTitle}>Change audience</Text>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={() => void handleSave()}
                disabled={!selectionDirty || saving}
                activeOpacity={selectionDirty && !saving ? 0.75 : 1}
                accessibilityRole="button"
                accessibilityLabel="Save audience"
                accessibilityState={{ disabled: !selectionDirty || saving }}
                hitSlop={8}
              >
                {saving ? (
                  <ActivityIndicator color={ACCENT} size="small" />
                ) : (
                  <Text
                    style={[
                      styles.saveBtnText,
                      !selectionDirty && styles.saveBtnTextDisabled,
                    ]}
                  >
                    Save
                  </Text>
                )}
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              bounces={false}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <SynqAudiencePicker
                groups={groups}
                selection={selection}
                onChangeSelection={setSelection}
                compact
              />
            </ScrollView>
          </View>
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
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetGroup: {
    paddingHorizontal: 12,
  },
  sheetCard: {
    backgroundColor: SHEET_SURFACE,
    borderRadius: BUTTON_RADIUS + 4,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
    maxHeight: Dimensions.get("window").height * 0.58,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: SPACE_3 + 2,
    paddingBottom: SPACE_3,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  sheetTitle: {
    flex: 1,
    color: TEXT,
    fontSize: TYPE_BODY,
    fontFamily: fonts.heavy,
    marginRight: SPACE_3,
  },
  saveBtn: {
    minWidth: 44,
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: {
    color: ACCENT,
    fontSize: TYPE_BODY,
    fontFamily: fonts.heavy,
    letterSpacing: 0.1,
  },
  saveBtnTextDisabled: {
    color: MUTED2,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingBottom: SPACE_3,
  },
});
