"use client";
import * as React from "react";
import { toast } from "sonner";
import { Plus, Trash2, Search } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { WeeklyReview, MonthlyReview, MistakeEntry } from "@/lib/types";

export default function PsychologyPage() {
  const [weekly, setWeekly] = React.useState<WeeklyReview[]>([]);
  const [monthly, setMonthly] = React.useState<MonthlyReview[]>([]);
  const [mistakes, setMistakes] = React.useState<MistakeEntry[]>([]);
  const [mistakeSearch, setMistakeSearch] = React.useState("");

  const load = React.useCallback(async () => {
    const [reviewsRes, mistakesRes] = await Promise.all([fetch("/api/reviews"), fetch("/api/mistakes")]);
    const reviews = await reviewsRes.json();
    const mistakesData = await mistakesRes.json();
    setWeekly(reviews.weekly);
    setMonthly(reviews.monthly);
    setMistakes(mistakesData.mistakes);
  }, []);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const filteredMistakes = mistakes.filter(
    (m) => !mistakeSearch || m.title.toLowerCase().includes(mistakeSearch.toLowerCase()) || m.description.toLowerCase().includes(mistakeSearch.toLowerCase()) || m.tag.toLowerCase().includes(mistakeSearch.toLowerCase())
  );

  return (
    <div>
      <Topbar title="Trading Psychology" description="Weekly and monthly reviews, plus a searchable library of past mistakes." />
      <div className="p-4 lg:p-8">
        <Tabs defaultValue="weekly">
          <TabsList>
            <TabsTrigger value="weekly">Weekly Review</TabsTrigger>
            <TabsTrigger value="monthly">Monthly Review</TabsTrigger>
            <TabsTrigger value="mistakes">Mistake Library</TabsTrigger>
          </TabsList>

          <TabsContent value="weekly">
            <WeeklyReviewForm onSaved={load} />
            <div className="mt-4 flex flex-col gap-3">
              {weekly.map((r) => (
                <Card key={r.id}>
                  <CardHeader className="flex-row items-center justify-between">
                    <CardTitle className="text-foreground text-sm font-semibold">Week of {new Date(r.weekStart).toLocaleDateString()}</CardTitle>
                    <button
                      onClick={async () => {
                        await fetch(`/api/reviews?kind=weekly&id=${r.id}`, { method: "DELETE" });
                        load();
                      }}
                      className="text-muted-foreground hover:text-loss"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2 text-sm">
                    <Row label="Wins" value={r.wins} />
                    <Row label="Mistakes" value={r.mistakes} />
                    <Row label="Lessons" value={r.lessons} />
                    <Row label="Goal for next week" value={r.goalForNextWeek} />
                  </CardContent>
                </Card>
              ))}
              {weekly.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">No weekly reviews yet.</p>}
            </div>
          </TabsContent>

          <TabsContent value="monthly">
            <MonthlyReviewForm onSaved={load} />
            <div className="mt-4 flex flex-col gap-3">
              {monthly.map((r) => (
                <Card key={r.id}>
                  <CardHeader className="flex-row items-center justify-between">
                    <CardTitle className="text-foreground text-sm font-semibold">{new Date(r.monthStart).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</CardTitle>
                    <button
                      onClick={async () => {
                        await fetch(`/api/reviews?kind=monthly&id=${r.id}`, { method: "DELETE" });
                        load();
                      }}
                      className="text-muted-foreground hover:text-loss"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2 text-sm">
                    <Row label="Summary" value={r.summary} />
                    <Row label="Lessons" value={r.lessons} />
                    <Row label="Goal for next month" value={r.goalForNextMonth} />
                  </CardContent>
                </Card>
              ))}
              {monthly.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">No monthly reviews yet.</p>}
            </div>
          </TabsContent>

          <TabsContent value="mistakes">
            <MistakeForm onSaved={load} />
            <div className="mt-4 flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search mistakes…" value={mistakeSearch} onChange={(e) => setMistakeSearch(e.target.value)} className="w-64" />
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {filteredMistakes.map((m) => (
                <Card key={m.id}>
                  <CardContent className="p-4 flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{m.title}</span>
                        {m.tag && <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] text-accent">{m.tag}</span>}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">{m.description}</p>
                    </div>
                    <button
                      onClick={async () => {
                        await fetch(`/api/mistakes?id=${m.id}`, { method: "DELETE" });
                        load();
                      }}
                      className="text-muted-foreground hover:text-loss shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </CardContent>
                </Card>
              ))}
              {filteredMistakes.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">No mistakes logged yet — good sign, or time to log one.</p>}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <p className="whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function WeeklyReviewForm({ onSaved }: { onSaved: () => void }) {
  const [form, setForm] = React.useState({ weekStart: new Date().toISOString().slice(0, 10), wins: "", mistakes: "", lessons: "", goalForNextWeek: "" });
  const [saving, setSaving] = React.useState(false);

  async function save() {
    setSaving(true);
    const res = await fetch("/api/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "weekly", ...form }) });
    setSaving(false);
    if (!res.ok) {
      toast.error("Failed to save review.");
      return;
    }
    toast.success("Weekly review saved.");
    setForm({ weekStart: new Date().toISOString().slice(0, 10), wins: "", mistakes: "", lessons: "", goalForNextWeek: "" });
    onSaved();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-foreground text-sm font-semibold">New Weekly Review</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5 max-w-xs">
          <Label>Week starting</Label>
          <Input type="date" value={form.weekStart} onChange={(e) => setForm({ ...form, weekStart: e.target.value })} />
        </div>
        <LabeledTextarea label="What went well this week?" value={form.wins} onChange={(v) => setForm({ ...form, wins: v })} />
        <LabeledTextarea label="What mistakes did I make?" value={form.mistakes} onChange={(v) => setForm({ ...form, mistakes: v })} />
        <LabeledTextarea label="Key lessons learned" value={form.lessons} onChange={(v) => setForm({ ...form, lessons: v })} />
        <LabeledTextarea label="Goal for next week" value={form.goalForNextWeek} onChange={(v) => setForm({ ...form, goalForNextWeek: v })} />
        <Button onClick={save} disabled={saving} className="w-fit">
          <Plus className="h-3.5 w-3.5" /> Save Weekly Review
        </Button>
      </CardContent>
    </Card>
  );
}

function MonthlyReviewForm({ onSaved }: { onSaved: () => void }) {
  const [form, setForm] = React.useState({ monthStart: new Date().toISOString().slice(0, 10), summary: "", lessons: "", goalForNextMonth: "" });
  const [saving, setSaving] = React.useState(false);

  async function save() {
    setSaving(true);
    const res = await fetch("/api/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "monthly", ...form }) });
    setSaving(false);
    if (!res.ok) {
      toast.error("Failed to save review.");
      return;
    }
    toast.success("Monthly review saved.");
    setForm({ monthStart: new Date().toISOString().slice(0, 10), summary: "", lessons: "", goalForNextMonth: "" });
    onSaved();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-foreground text-sm font-semibold">New Monthly Review</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5 max-w-xs">
          <Label>Month starting</Label>
          <Input type="date" value={form.monthStart} onChange={(e) => setForm({ ...form, monthStart: e.target.value })} />
        </div>
        <LabeledTextarea label="Summary of the month" value={form.summary} onChange={(v) => setForm({ ...form, summary: v })} />
        <LabeledTextarea label="Key lessons learned" value={form.lessons} onChange={(v) => setForm({ ...form, lessons: v })} />
        <LabeledTextarea label="Goal for next month" value={form.goalForNextMonth} onChange={(v) => setForm({ ...form, goalForNextMonth: v })} />
        <Button onClick={save} disabled={saving} className="w-fit">
          <Plus className="h-3.5 w-3.5" /> Save Monthly Review
        </Button>
      </CardContent>
    </Card>
  );
}

function MistakeForm({ onSaved }: { onSaved: () => void }) {
  const [form, setForm] = React.useState({ title: "", description: "", tag: "" });
  const [saving, setSaving] = React.useState(false);

  async function save() {
    if (!form.title.trim()) {
      toast.error("Give this mistake a short title.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/mistakes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setSaving(false);
    if (!res.ok) {
      toast.error("Failed to save.");
      return;
    }
    toast.success("Mistake logged.");
    setForm({ title: "", description: "", tag: "" });
    onSaved();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-foreground text-sm font-semibold">Log a Mistake</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex gap-3">
          <div className="flex-1 flex flex-col gap-1.5">
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Moved stop-loss out of fear" />
          </div>
          <div className="w-40 flex flex-col gap-1.5">
            <Label>Tag</Label>
            <Input value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} placeholder="e.g. Discipline" />
          </div>
        </div>
        <LabeledTextarea label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
        <Button onClick={save} disabled={saving} className="w-fit">
          <Plus className="h-3.5 w-3.5" /> Add to Library
        </Button>
      </CardContent>
    </Card>
  );
}

function LabeledTextarea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
