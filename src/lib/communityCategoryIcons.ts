import { ACCENT } from "@/constants/Variables";
import { Ionicons } from "@expo/vector-icons";
import {
  COMMUNITY_GROUP_CATEGORIES,
  type CommunityGroupCategory,
} from "./communityGroupCategories";

export function getCommunityCategoryIcon(
  category: string
): keyof typeof Ionicons.glyphMap {
  const icons: Record<CommunityGroupCategory, keyof typeof Ionicons.glyphMap> = {
    Sports: "football-outline",
    Social: "people-outline",
    "Food & Drink": "restaurant-outline",
    Fitness: "barbell-outline",
    Music: "musical-notes-outline",
    Outdoors: "leaf-outline",
    Other: "sparkles-outline",
  };

  if ((COMMUNITY_GROUP_CATEGORIES as readonly string[]).includes(category)) {
    return icons[category as CommunityGroupCategory];
  }
  return icons.Other;
}

export const COMMUNITY_CATEGORY_ICON_RING = {
  backgroundColor: "rgba(0,255,133,0.1)",
  borderColor: "rgba(0,255,133,0.22)",
  iconColor: ACCENT,
} as const;
