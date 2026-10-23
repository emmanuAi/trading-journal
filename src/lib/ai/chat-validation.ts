export const MAX_MESSAGE_LENGTH = 2000;

export interface ChatRequestBody {
  message: string;
  accountId: string | null;
  aggregated: boolean;
}

export type ValidationResult = { ok: true; body: ChatRequestBody } | { ok: false; error: string };

/** Pure request-shape validation, kept separate from auth/account-ownership
 * checks (those need the database and live in the route). Bounds the
 * message length so a single oversized message can't blow past the
 * per-call cost ceiling enforced server-side in Postgres. */
export function validateChatRequest(body: unknown): ValidationResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const b = body as Record<string, unknown>;

  if (typeof b.message !== "string" || b.message.trim().length === 0) {
    return { ok: false, error: "message is required." };
  }
  if (b.message.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, error: `message must be ${MAX_MESSAGE_LENGTH} characters or fewer.` };
  }

  const aggregated = b.aggregated === true;

  if (!aggregated) {
    if (typeof b.accountId !== "string" || b.accountId.length === 0) {
      return { ok: false, error: "accountId is required unless aggregated is true." };
    }
  }

  return {
    ok: true,
    body: {
      message: b.message.trim(),
      accountId: typeof b.accountId === "string" ? b.accountId : null,
      aggregated,
    },
  };
}
