export const MIN_POLL_OPTIONS: number;
export const MAX_POLL_OPTIONS: number;
export const MAX_POLL_QUESTION_LENGTH: number;
export const MAX_POLL_OPTION_LENGTH: number;

export function isPollMessage(item?: { type?: string } | null): boolean;

export function normalizePollOptions(options: unknown): string[];

export function validatePollDraft(
  question: unknown,
  options: unknown
):
  | { ok: false; reason: string }
  | { ok: true; question: string; options: string[] };

export function parsePollVotes(raw: unknown): Record<string, number>;

export function pollVoteCounts(
  optionCount: number,
  votes: unknown
): number[];

export function pollVoteTotal(votes: unknown): number;

export function pollPreviewText(question: unknown): string;
