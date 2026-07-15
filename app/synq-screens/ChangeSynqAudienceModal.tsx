import { sheetStyles } from "@/constants/sheetStyles";
import {
  ACCENT,
  GROUP_BORDER,
  MUTED2,
  SPACE_3,
  TYPE_BODY,
  fonts,
} from "@/constants/Variables";
import SpringBottomSheet from "@/src/components/sheets/SpringBottomSheet";
import SynqAudiencePicker from "@/src/components/synq/SynqAudiencePicker";
import type { FriendGroup } from "@/src/lib/friendGroups";
import type { SynqAudienceSelection } from "@/src/lib/synqBroadcast";
import { useEffect, useMemo, useState } from "react";
import {
  Dimensions,
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
    <SpringBottomSheet
      visible={visible}
      onClose={onClose}
      contentStyle={[styles.sheetGroup, { paddingBottom: insets.bottom + SPACE_3 }]}
      cardStyle={[sheetStyles.sheetCard, styles.sheetCard]}
    >
      <View style={styles.headerRow}>
        <Text style={[sheetStyles.sheetHeaderTitle, styles.sheetTitleFlex]}>
          Sharing with
        </Text>
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
            <Text
              style={[
                styles.saveBtnText,
                !selectionDirty && styles.saveBtnTextDisabled,
                saving && { opacity: 0.5 },
              ]}
            >
              Save
            </Text>
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
    </SpringBottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetGroup: {
    paddingHorizontal: 12,
  },
  sheetCard: {
    maxHeight: Dimensions.get("window").height * 0.58,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: SPACE_3,
    paddingBottom: SPACE_3,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: GROUP_BORDER,
  },
  sheetTitleFlex: {
    flex: 1,
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
