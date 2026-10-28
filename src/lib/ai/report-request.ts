import { getLocalWeekWindow, type WeekWindow } from "./weekly-snapshot";

export interface GenerateReportBody {
  weekStart: string;
  accountId: string | null;
  aggregated: boolean;
  regenerate: boolean;
}

export type ValidationResult = { ok: true; body: GenerateReportBody } | { ok: false; error: string };

const WEEK_START_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Pure request-shape validation — mirrors chat-validation.ts. Ownership of
 * accountId and the week's timezone-authoritative correctness are checked
 * later (they need the database / the owner's settings), not here. */
export function validateGenerateReportRequest(body: unknown): ValidationResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const b = body as Record<string, unknown>;

  if (typeof b.weekStart !== "string" || !WEEK_START_PATTERN.test(b.weekStart)) {
    return { ok: false, error: "weekStart is required and must be a YYYY-MM-DD date string." };
  }

  const aggregated = b.aggregated === true;
  if (!aggregated && (typeof b.accountId !== "string" || b.accountId.length === 0)) {
    return { ok: false, error: "accountId is required unless aggregated is true." };
  }

  return {
    ok: true,
    body: {
      weekStart: b.weekStart,
      accountId: typeof b.accountId === "string" ? b.accountId : null,
      aggregated,
      regenerate: b.regenerate === true,
    },
  };
}

export type WeekValidationResult = { ok: true; window: WeekWindow } | { ok: false; error: string };

/** The server never trusts a client-computed week window — only the chosen
 * Monday date string. This recomputes the canonical window from that date
 * and the owner's own stored timezone, then checks two things a tampered
 * or buggy client request could get wrong: (1) the submitted date really is
 * the Monday of its week in this timezone — if it isn't, recomputing from
 * it won't round-trip to the same string; (2) the week isn't in the future
 * (the current, in-progress week is allowed; a week that hasn't started
 * yet is not). */
export function resolveAndValidateWeek(weekStartInput: string, timezone: string): WeekValidationResult {
  const referenceDate = new Date(`${weekStartInput}T12:00:00.000Z`);
  if (Number.isNaN(referenceDate.getTime())) {
    return { ok: false, error: "weekStart is not a valid date." };
  }

  const window = getLocalWeekWindow(referenceDate, timezone, 0);
  if (window.weekStart !== weekStartInput) {
    return { ok: false, error: "weekStart must be the Monday of its week." };
  }

  const currentWeek = getLocalWeekWindow(new Date(), timezone, 0);
  if (window.weekStart > currentWeek.weekStart) {
    return { ok: false, error: "Cannot generate a report for a future week." };
  }

  return { ok: true, window };
}
