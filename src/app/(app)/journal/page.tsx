"use client";
import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Download, Upload, PlusCircle } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { useAccountContext } from "@/components/layout/account-context";
import { useTrades, useSettings } from "@/lib/hooks";
import { TradesTable } from "@/components/journal/trades-table";
import { TimeRangePicker, type DateRange } from "@/components/dashboard/time-range-picker";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EMOTION_TAGS } from "@/lib/types";

export default function JournalPage() {
  const { accounts, activeAccountId } = useAccountContext();
  const { settings } = useSettings();
  const account = accounts.find((a) => a.id === activeAccountId);
  const currency = account?.baseCurrency ?? settings?.baseCurrency ?? "EUR";

  const [range, setRange] = React.useState<DateRange>({ key: "all" });
  const [search, setSearch] = React.useState("");
  const [result, setResult] = React.useState("all");
  const [direction, setDirection] = React.useState("all");
  const [strategy, setStrategy] = React.useState("all");
  const [emotion, setEmotion] = React.useState("all");
  const [followedPlan, setFollowedPlan] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [importing, setImporting] = React.useState(false);

  const { trades, loading, refresh } = useTrades({
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
    search,
    result,
    direction,
    strategy: strategy === "all" ? undefined : strategy,
    emotion: emotion === "all" ? undefined : emotion,
    followedPlan,
    status,
  });

  async function handleImport(file: File) {
    if (!account) return;
    setImporting(true);
    const csv = await file.text();
    const res = await fetch("/api/import/csv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv, accountId: account.id }),
    });
    const data = await res.json();
    setImporting(false);
    if (!res.ok) {
      toast.error(data.error ?? "Import failed.");
      return;
    }
    toast.success(`Imported ${data.imported} trades. Skipped ${data.skippedDuplicates} duplicates.`);
    refresh();
  }

  return (
    <div>
      <Topbar title="Trade Journal" description="Every trade you've logged, searchable and filterable." />
      <div className="p-4 lg:p-8 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input placeholder="Search instrument, ID, strategy…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-56" />
            <TimeRangePicker value={range} onChange={setRange} />
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) handleImport(e.target.files[0]);
                e.target.value = "";
              }}
            />
            <Button variant="outline" size="sm" disabled={importing} onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" /> {importing ? "Importing…" : "Import CSV"}
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={`/api/export/csv?accountId=${account?.id ?? ""}`} download>
                <Download className="h-3.5 w-3.5" /> Export CSV
              </a>
            </Button>
            <Button size="sm" asChild>
              <Link href="/trades/new">
                <PlusCircle className="h-3.5 w-3.5" /> Add Trade
              </Link>
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect value={result} onChange={setResult} label="Result" options={[["all", "All Results"], ["win", "Win"], ["loss", "Loss"], ["breakeven", "Breakeven"]]} />
          <FilterSelect value={direction} onChange={setDirection} label="Direction" options={[["all", "All Directions"], ["long", "Long"], ["short", "Short"]]} />
          <FilterSelect value={status} onChange={setStatus} label="Status" options={[["all", "All Status"], ["open", "Open"], ["closed", "Closed"], ["cancelled", "Cancelled"]]} />
          <FilterSelect
            value={strategy}
            onChange={setStrategy}
            label="Strategy"
            options={[["all", "All Strategies"], ...(settings?.strategies ?? []).map((s) => [s, s] as [string, string])]}
          />
          <FilterSelect value={emotion} onChange={setEmotion} label="Emotion" options={[["all", "All Emotions"], ...EMOTION_TAGS.map((e) => [e, e] as [string, string])]} />
          <FilterSelect value={followedPlan} onChange={setFollowedPlan} label="Plan" options={[["all", "All Trades"], ["yes", "Followed Plan"], ["no", "Broke Plan"]]} />
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? <div className="h-64 animate-pulse bg-surface" /> : <TradesTable trades={trades} currency={currency} />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
  label: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-auto min-w-[9rem]">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {options.map(([v, l]) => (
          <SelectItem key={v} value={v}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
