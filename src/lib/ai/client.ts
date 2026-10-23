import Anthropic from "@anthropic-ai/sdk";

/** Server-only. The one place ANTHROPIC_API_KEY is read — never imported
 * from a Client Component, never sent to the browser. */
export const anthropic = new Anthropic();

export const COACH_MODEL = "claude-sonnet-5" as const;

export const CHAT_MAX_OUTPUT_TOKENS = 1024;
export const MAX_TOOL_ITERATIONS = 6;
