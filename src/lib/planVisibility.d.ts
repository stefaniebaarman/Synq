export type PlanVisibility = "open" | "private";

export function isPrivatePlan(event: any): boolean;
export function isOpenPlan(event: any): boolean;
export function filterToOpenPlans<T>(events: T[] | null | undefined): T[];
export function findSoonUpcomingPlan(
  events: any[] | null | undefined,
  options?: { now?: Date; windowMs?: number }
): any | null;
export function formatSoonPlanConfirmMessage(event: any): string;
export const SOON_PLAN_WINDOW_MS: number;
