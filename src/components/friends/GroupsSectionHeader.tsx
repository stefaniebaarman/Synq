import { ACCENT, MUTED2 } from "@/constants/Variables";
import { groupsPageStyles } from "@/src/components/friends/groupsListStyles";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

const SECTION_ADD_GLYPH_SIZE = 14;

type Props = {
  title: string;
  onAdd: () => void;
  addAccessibilityLabel: string;
  onInfo: () => void;
  infoAccessibilityLabel: string;
};

export default function GroupsSectionHeader({
  title,
  onAdd,
  addAccessibilityLabel,
  onInfo,
  infoAccessibilityLabel,
}: Props) {
  return (
    <View style={groupsPageStyles.sectionTitleRow}>
      <View style={groupsPageStyles.sectionTitleStart}>
        <Text style={groupsPageStyles.sectionTitle}>{title}</Text>
        <TouchableOpacity
          style={groupsPageStyles.infoBtn}
          onPress={onInfo}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={infoAccessibilityLabel}
        >
          <Ionicons name="information-circle-outline" size={16} color={MUTED2} />
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={groupsPageStyles.sectionAddBtn}
        onPress={onAdd}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={addAccessibilityLabel}
        activeOpacity={0.82}
      >
        <Ionicons name="add" size={SECTION_ADD_GLYPH_SIZE} color={ACCENT} />
      </TouchableOpacity>
    </View>
  );
}
