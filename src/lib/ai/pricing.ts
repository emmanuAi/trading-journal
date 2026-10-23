/** Per-model USD pricing, $ per token (not per million) for direct
 * multiplication against token counts. Source: the AI Coach plan's pricing
 * table. Keep in sync with Anthropic's published rates — a mismatch here
 * silently drifts the budget ledger away from real billed cost. */
const PRICING = {
  "claude-sonnet-5": {
    inputPerToken: 2 / 1_000_000,
    outputPerToken: 10 / 1_000_000,
  },
} as const;

export type PricedModel = keyof typeof PRICING;

/** Conservative upper-bound estimate for a call's cost, used to size the
 * pre-call budget reservation (see reserve_ai_spend in the Phase 2 schema).
 * Uses `maxOutputTokens` (a hard ceiling the API enforces) rather than an
 * expected output length, so the real cost can never exceed this estimate —
 * actual spend is always looked up afterward from the response's own
 * `usage` object and reconciled down. */
export function estimateCallCostUsd(model: PricedModel, estimatedInputTokens: number, maxOutputTokens: number): number {
  const p = PRICING[model];
  return estimatedInputTokens * p.inputPerToken + maxOutputTokens * p.outputPerToken;
}

/** Real cost of a completed call from the API response's own usage figures.
 * Cache creation/read tokens are billed at different rates than plain input
 * tokens, but are priced here at the plain input rate as a conservative
 * (never-under-counts) simplification — exact cache multipliers should be
 * confirmed against Anthropic's current published rates before relying on
 * this for anything beyond the app's own soft budget guard. */
export function computeActualCostUsd(
  model: PricedModel,
  usage: { input_tokens: number; output_tokens: number; cache_creation_input_tokens?: number | null; cache_read_input_tokens?: number | null }
): number {
  const p = PRICING[model];
  const inputTokens = usage.input_tokens + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
  return inputTokens * p.inputPerToken + usage.output_tokens * p.outputPerToken;
}

/** Rough chars-to-tokens estimate for sizing a pre-call reservation when the
 * real input token count isn't known yet (before the request is sent).
 * Deliberately generous (3 chars/token, most real text is ~4) so the
 * reservation stays a true upper bound. */
export function estimateTokensFromText(text: string): number {
  return Math.ceil(text.length / 3);
}
