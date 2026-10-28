"use client";
import * as React from "react";
import useSWR from "swr";
import { Sparkles, Send, AlertTriangle, Bot, User as UserIcon, Plus, Trash2, MessageSquare } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { useAccountContext } from "@/components/layout/account-context";
import { fetcher } from "@/lib/hooks";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ChatMarkdown } from "@/components/coach/chat-markdown";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface BudgetStatus {
  status: "ok" | "warning" | "exhausted";
  percentUsed: number;
  warning: boolean;
}

interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}

const SUGGESTIONS = ["What's my win rate this month?", "What are my worst trades lately?", "How's my plan compliance?"];

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function CoachPage() {
  const { activeAccountId, aggregated, loading: accountsLoading } = useAccountContext();
  const { data: budget } = useSWR<BudgetStatus>("/api/coach/budget-status", fetcher, { refreshInterval: 60_000 });
  const {
    data: conversationsData,
    mutate: mutateConversations,
  } = useSWR<{ conversations: ConversationSummary[] }>("/api/coach/conversations", fetcher, { revalidateOnFocus: false });
  const conversations = conversationsData?.conversations ?? [];

  const [conversationId, setConversationId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [loadingConversation, setLoadingConversation] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const budgetExhausted = budget?.status === "exhausted";

  function startNewChat() {
    setConversationId(null);
    setMessages([]);
    setInput("");
  }

  async function openConversation(id: string) {
    if (id === conversationId || loadingConversation) return;
    setLoadingConversation(true);
    try {
      const res = await fetch(`/api/coach/conversations/${id}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't load that conversation.");
        return;
      }
      setConversationId(id);
      setMessages(data.messages.map((m: ChatMessage) => ({ role: m.role, content: m.content })));
    } catch {
      toast.error("Network error loading that conversation.");
    } finally {
      setLoadingConversation(false);
    }
  }

  async function removeConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/coach/conversations/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Couldn't delete that conversation.");
        return;
      }
      if (id === conversationId) startNewChat();
      mutateConversations();
    } catch {
      toast.error("Network error deleting that conversation.");
    }
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending || accountsLoading || budgetExhausted) return;

    setMessages((m) => [...m, { role: "user", content: trimmed }]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/coach/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          accountId: aggregated ? null : activeAccountId,
          aggregated,
          conversationId,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "The AI coach couldn't answer that.");
        setMessages((m) => m.slice(0, -1));
        return;
      }

      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
      if (data.conversationId && data.conversationId !== conversationId) {
        setConversationId(data.conversationId);
      }
      mutateConversations();
    } catch {
      toast.error("Network error reaching the AI coach.");
      setMessages((m) => m.slice(0, -1));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col h-screen">
      <Topbar title="AI Coach" description="Ask questions about your own trading performance" />

      <div className="flex-1 flex px-4 py-4 lg:px-8 gap-4 overflow-hidden">
        <Card className="hidden md:flex w-64 shrink-0 flex-col overflow-hidden">
          <div className="p-3 border-b border-border">
            <Button variant="secondary" size="sm" className="w-full justify-start gap-2" onClick={startNewChat}>
              <Plus className="h-4 w-4" /> New chat
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="flex flex-col p-2 gap-0.5">
              {conversations.length === 0 && (
                <p className="text-xs text-muted-foreground px-2 py-3">No past conversations yet.</p>
              )}
              {conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => openConversation(c.id)}
                  className={cn(
                    "group flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                    c.id === conversationId ? "bg-accent/15 text-accent" : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                  )}
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 min-w-0 truncate">{c.title}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0 group-hover:hidden">{formatRelativeTime(c.updatedAt)}</span>
                  <Trash2
                    className="h-3.5 w-3.5 shrink-0 hidden group-hover:block hover:text-loss"
                    onClick={(e) => removeConversation(c.id, e)}
                  />
                </button>
              ))}
            </div>
          </ScrollArea>
        </Card>

        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {budget && budget.status !== "ok" && (
            <Card className={cn("border-l-2", budget.status === "exhausted" ? "border-l-loss" : "border-l-warning")}>
              <CardContent className="flex items-center gap-2 py-3 text-sm">
                <AlertTriangle className={cn("h-4 w-4 shrink-0", budget.status === "exhausted" ? "text-loss" : "text-warning")} />
                {budget.status === "exhausted"
                  ? "This month's AI coach budget has been reached. Chat will be available again next month."
                  : `This month's AI coach budget is at ${budget.percentUsed}% — responses may pause once the limit is reached.`}
              </CardContent>
            </Card>
          )}

          <Card className="flex-1 flex flex-col overflow-hidden">
            <ScrollArea className="flex-1 px-5 py-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-10">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent/50 shadow-[0_0_20px_-4px_var(--accent)]">
                    <Sparkles className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Ask your AI Coach anything about your trading</p>
                    <p className="text-xs text-muted-foreground mt-1">Answers are grounded in your own trade data — nothing is invented.</p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="rounded-full border border-border bg-surface-2 px-3 py-1.5 text-xs text-muted-foreground hover:bg-surface-2/70 hover:text-foreground transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {messages.map((m, i) => (
                    <div key={i} className={cn("flex gap-3", m.role === "user" && "justify-end")}>
                      {m.role === "assistant" && (
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/15">
                          <Bot className="h-4 w-4 text-accent" />
                        </div>
                      )}
                      <div
                        className={cn(
                          "max-w-[75%] rounded-xl px-4 py-2.5",
                          m.role === "user" ? "bg-accent text-accent-foreground text-sm whitespace-pre-wrap" : "bg-surface-2 text-foreground"
                        )}
                      >
                        {m.role === "assistant" ? <ChatMarkdown content={m.content} /> : m.content}
                      </div>
                      {m.role === "user" && (
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-2">
                          <UserIcon className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  ))}
                  {sending && (
                    <div className="flex gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/15">
                        <Bot className="h-4 w-4 text-accent" />
                      </div>
                      <div className="rounded-xl bg-surface-2 px-4 py-2.5 text-sm text-muted-foreground">Thinking…</div>
                    </div>
                  )}
                  <div ref={scrollRef} />
                </div>
              )}
            </ScrollArea>

            <div className="border-t border-border p-3 flex gap-2 items-end">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                placeholder={budgetExhausted ? "AI coach budget reached for this month…" : "Ask about your trading performance…"}
                disabled={sending || accountsLoading || budgetExhausted}
                className="min-h-[44px] max-h-32 resize-none"
              />
              <Button onClick={() => send(input)} disabled={sending || accountsLoading || budgetExhausted || !input.trim()} size="icon">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
