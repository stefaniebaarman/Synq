import type { CommunityGroupPlan } from "./communityGroupPlans";
export {
  formatGoerNamesLabel,
  formatPlanGoerPreview,
  resolvePlanGoers,
} from "./communityPlanMembersCore.js";

export type CommunityPlanMemberProfile = {
  id: string;
  displayName: string;
  imageurl?: string;
  synqActive?: boolean;
};

export type { CommunityGroupPlan };
