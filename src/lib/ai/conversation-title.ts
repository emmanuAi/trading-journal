const MAX_TITLE_LENGTH = 60;

/** Derives a short conversation title from the opening message — pure, so
 * it's unit-testable without touching the database. */
export function deriveConversationTitle(message: string): string {
  const collapsed = message.replace(/\s+/g, " ").trim();
  if (collapsed.length <= MAX_TITLE_LENGTH) return collapsed || "New conversation";
  return collapsed.slice(0, MAX_TITLE_LENGTH - 1).trimEnd() + "…";
}
