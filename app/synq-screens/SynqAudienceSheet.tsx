import { sheetStyles } from "@/constants/sheetStyles";
import { SPACE_3, SPACE_4, SPACE_5 } from "@/constants/Variables";
import SpringBottomSheet from "@/src/components/sheets/SpringBottomSheet";
import SynqAudiencePicker from "@/src/components/synq/SynqAudiencePicker";
import type { FriendGroup } from "@/src/lib/friendGroups";
import type { SynqAudienceSelection } from "@/src/lib/synqBroadcast";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  visible: boolean;
  groups: FriendGroup[];
  selection: SynqAudienceSelection;
  onChangeSelection: (next: SynqAudienceSelection) => void;
  onClose: () => void;
};

export default function SynqAudienceSheet({
  visible,
  groups,
  selection,
  onChangeSelection,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();

  const handleSelect = (next: SynqAudienceSelection) => {
    onChangeSelection(next);
    onClose();
  };

  return (
    <SpringBottomSheet
      visible={visible}
      onClose={onClose}
      contentStyle={[styles.sheetGroup, { paddingBottom: insets.bottom + SPACE_4 }]}
      cardStyle={sheetStyles.sheetCard}
    >
      <Text style={[sheetStyles.sheetTitle, styles.sheetTitlePad]}>
        Visible to
      </Text>
      <View style={styles.pickerSection}>
        <SynqAudiencePicker
          groups={groups}
          selection={selection}
          onChangeSelection={handleSelect}
          singleSelect
        />
      </View>
    </SpringBottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetGroup: {
    paddingHorizontal: SPACE_5,
  },
  sheetTitlePad: {
    paddingTop: SPACE_3,
    paddingBottom: SPACE_4,
    paddingHorizontal: SPACE_4,
    textAlign: "left",
    alignSelf: "stretch",
  },
  pickerSection: {
    paddingBottom: SPACE_4,
  },
});
