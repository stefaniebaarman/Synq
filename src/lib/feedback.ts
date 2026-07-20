import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "./firebase";

export type FeedbackType = "Feedback" | "Bug" | "Feature request" | "Other";

export type SubmitFeedbackParams = {
  type: FeedbackType;
  message: string;
  platform?: string;
};

const functions = getFunctions(app, "us-central1");

export async function submitFeedback(params: SubmitFeedbackParams) {
  const fn = httpsCallable(functions, "submitFeedback");
  const res = await fn(params);
  return res.data as {
    ok: boolean;
    feedbackId?: string;
    emailSent?: boolean;
  };
}
