import { createClient, requireUser } from "../supabase/server";
import type { CoachConversation, CoachMessage } from "../ai/types";

const HISTORY_LIMIT = 20;

interface ConversationRow {
  id: string;
  account_id: string | null;
  title: string;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  created_at: string;
}

function rowToConversation(row: ConversationRow): CoachConversation {
  return { id: row.id, accountId: row.account_id, title: row.title, createdAt: row.created_at, updatedAt: row.updated_at };
}

function rowToMessage(row: MessageRow): CoachMessage {
  return { id: row.id, conversationId: row.conversation_id, role: row.role as CoachMessage["role"], content: row.content, createdAt: row.created_at };
}

export async function listConversations(): Promise<CoachConversation[]> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  const { data, error } = await supabase
    .from("coach_conversations")
    .select("*")
    .eq("owner", user.id)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data as ConversationRow[]).map(rowToConversation);
}

export async function getConversation(id: string): Promise<CoachConversation | null> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  const { data, error } = await supabase.from("coach_conversations").select("*").eq("id", id).eq("owner", user.id).maybeSingle();
  if (error) throw error;
  return data ? rowToConversation(data as ConversationRow) : null;
}

export async function deleteConversation(id: string): Promise<void> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  const { error } = await supabase.from("coach_conversations").delete().eq("id", id).eq("owner", user.id);
  if (error) throw error;
}

/** Last `HISTORY_LIMIT` messages, chronological order — matches decision 5
 * of the plan ("conversation length is capped at the last ~20 messages
 * sent to the model; older messages stay in Supabase for display"). */
export async function listRecentMessages(conversationId: string): Promise<CoachMessage[]> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  const { data, error } = await supabase
    .from("coach_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("owner", user.id)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  if (error) throw error;
  return (data as MessageRow[]).map(rowToMessage).reverse();
}

/** All messages for display (not capped) — used when opening a past
 * conversation in the UI, distinct from the model-context-limited fetch
 * above. */
export async function listAllMessages(conversationId: string): Promise<CoachMessage[]> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  const { data, error } = await supabase
    .from("coach_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("owner", user.id)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as MessageRow[]).map(rowToMessage);
}

/** Creates a conversation and appends the first user+assistant turn in one
 * pass — called only after a chat call has already succeeded, so a failed
 * first message never leaves behind an empty conversation row. */
export async function createConversationWithTurn(
  accountId: string | null,
  title: string,
  userContent: string,
  assistantContent: string
): Promise<CoachConversation> {
  const supabase = await createClient();
  const user = await requireUser(supabase);

  const { data: conv, error: convError } = await supabase
    .from("coach_conversations")
    .insert({ owner: user.id, account_id: accountId, title })
    .select()
    .single();
  if (convError) throw convError;

  const conversation = rowToConversation(conv as ConversationRow);
  await appendTurn(conversation.id, userContent, assistantContent);
  return conversation;
}

/** Appends a user+assistant turn to an existing conversation and bumps its
 * updated_at so the conversation list sorts most-recently-active first
 * (there's no DB trigger for this — the schema leaves updated_at to the
 * application). */
export async function appendTurn(conversationId: string, userContent: string, assistantContent: string): Promise<void> {
  const supabase = await createClient();
  const user = await requireUser(supabase);

  const { error: insertError } = await supabase.from("coach_messages").insert([
    { conversation_id: conversationId, owner: user.id, role: "user", content: userContent },
    { conversation_id: conversationId, owner: user.id, role: "assistant", content: assistantContent },
  ]);
  if (insertError) throw insertError;

  const { error: touchError } = await supabase
    .from("coach_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .eq("owner", user.id);
  if (touchError) throw touchError;
}
