export interface CoachConversation {
  id: string;
  accountId: string | null;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface CoachMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

/** Client-safe mirror of the Zod-inferred type in weekly-report.ts. Kept as
 * a separate, duplicate declaration (not imported from there) on purpose —
 * weekly-report.ts imports ./client, which constructs the server-only
 * Anthropic client at module scope, so nothing under "use client" may ever
 * import it, even just for a type. Keep this in sync by hand if that
 * module's ReportInterpretationSchema changes. */
export interface ReportActionItem {
  title: string;
  detail: string;
}

export interface ReportInterpretation {
  overview: string;
  strengths: string[];
  weaknesses: string[];
  patterns: string[];
  actionItems: ReportActionItem[];
  evidenceNote: string;
}

/** Client-safe mirror of WeeklyReportRecord in repository/weekly-reports.ts
 * — that file imports the server-only Supabase client, so it can't be
 * imported here either. WeeklySnapshot itself (unlike the two modules
 * above) has a fully client-safe import chain, so it's imported directly
 * rather than duplicated. */
export interface WeeklyReportSummary {
  id: string;
  accountId: string | null;
  weekStart: string;
  weekEnd: string;
  statsSnapshot: import("./weekly-snapshot").WeeklySnapshot;
  summaryText: string;
  modelUsed: string;
  tradesCount: number;
  createdAt: string;
}
