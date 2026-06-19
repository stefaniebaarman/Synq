export const COMMUNITY_GROUP_CATEGORIES = [
  "Sports",
  "Social",
  "Food & Drink",
  "Fitness",
  "Music",
  "Outdoors",
  "Other",
] as const;

export type CommunityGroupCategory = (typeof COMMUNITY_GROUP_CATEGORIES)[number];

export function isCommunityGroupCategory(value: string): value is CommunityGroupCategory {
  return (COMMUNITY_GROUP_CATEGORIES as readonly string[]).includes(value);
}
