import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "./firebase";

export type ReportReason =
  | "harassment"
  | "spam"
  | "hate"
  | "sexual"
  | "other";

export type ReportContentType = "message" | "user" | "profile" | "plan";

export type SubmitReportParams = {
  reportedUserId: string;
  contentType: ReportContentType;
  reason: ReportReason;
  details?: string;
  chatId?: string;
  messageId?: string;
  contentId?: string;
};

const functions = getFunctions(app, "us-central1");

export async function submitReport(params: SubmitReportParams) {
  const fn = httpsCallable(functions, "submitReport");
  const res = await fn(params);
  return res.data as {
    ok: boolean;
    queueId?: string;
    duplicate?: boolean;
    emailSent?: boolean;
  };
}

export async function blockUser(blockedUserId: string, details?: string) {
  const fn = httpsCallable(functions, "blockUser");
  const res = await fn({ blockedUserId, details, source: "manual" });
  return res.data as { ok: boolean; queueId?: string };
}

export async function unblockUser(blockedUserId: string) {
  const fn = httpsCallable(functions, "unblockUser");
  const res = await fn({ blockedUserId });
  return res.data as { ok: boolean };
}
