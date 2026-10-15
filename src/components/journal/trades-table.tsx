"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowUpDown, ImageOff, ImageIcon } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Trade } from "@/lib/types";
import { formatCurrency, formatNumber, formatR } from "@/lib/utils";

type SortKey = "date" | "pair" | "riskPercent" | "plannedRR" | "actualR" | "netPnl";

export function TradesTable({ trades, currency }: { trades: Trade[]; currency: string }) {
  const [sort, setSort] = React.useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "date", dir: "desc" });

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));
  }

  const sorted = React.useMemo(() => {
    const copy = [...trades];
    const dir = sort.dir === "asc" ? 1 : -1;
    copy.sort((a, b) => {
      switch (sort.key) {
        case "date":
          return (new Date(a.exitTime ?? a.entryTime).getTime() - new Date(b.exitTime ?? b.entryTime).getTime()) * dir;
        case "pair":
          return a.instrument.localeCompare(b.instrument) * dir;
        case "riskPercent":
          return ((a.riskPercent ?? 0) - (b.riskPercent ?? 0)) * dir;
        case "plannedRR":
          return ((a.plannedRR ?? 0) - (b.plannedRR ?? 0)) * dir;
        case "actualR":
          return ((a.actualR ?? 0) - (b.actualR ?? 0)) * dir;
        case "netPnl":
          return ((a.realizedPnl ?? 0) - (b.realizedPnl ?? 0)) * dir;
        default:
          return 0;
      }
    });
    return copy;
  }, [trades, sort]);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortableHead label="Date" sortKey="date" sort={sort} onSort={toggleSort} />
          <SortableHead label="Pair" sortKey="pair" sort={sort} onSort={toggleSort} />
          <TableHead>Direction</TableHead>
          <TableHead>Strategy</TableHead>
          <SortableHead label="Risk %" sortKey="riskPercent" sort={sort} onSort={toggleSort} />
          <SortableHead label="Planned RR" sortKey="plannedRR" sort={sort} onSort={toggleSort} />
          <SortableHead label="Actual R" sortKey="actualR" sort={sort} onSort={toggleSort} />
          <SortableHead label="Net P&L" sortKey="netPnl" sort={sort} onSort={toggleSort} />
          <TableHead>Result</TableHead>
          <TableHead>Screenshots</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((t) => (
          <TableRow key={t.id} className="cursor-pointer">
            <TableCell>
              <Link href={`/journal/${t.id}`} className="block">
                {new Date(t.exitTime ?? t.entryTime).toLocaleDateString()}
              </Link>
            </TableCell>
            <TableCell>
              <Link href={`/journal/${t.id}`} className="font-medium">
                {t.instrument}
              </Link>
            </TableCell>
            <TableCell>
              <Badge variant={t.direction === "long" ? "accent" : "outline"}>{t.direction === "long" ? "Long" : "Short"}</Badge>
            </TableCell>
            <TableCell className="text-muted-foreground">{t.strategy ?? "—"}</TableCell>
            <TableCell>{t.riskPercent != null ? `${formatNumber(t.riskPercent)}%` : "—"}</TableCell>
            <TableCell>{t.plannedRR != null ? `1:${formatNumber(t.plannedRR)}` : "—"}</TableCell>
            <TableCell className={t.actualR != null ? (t.actualR >= 0 ? "text-profit" : "text-loss") : ""}>{t.actualR != null ? formatR(t.actualR) : "—"}</TableCell>
            <TableCell className={t.realizedPnl != null ? (t.realizedPnl >= 0 ? "text-profit font-medium" : "text-loss font-medium") : ""}>
              {t.realizedPnl != null ? formatCurrency(t.realizedPnl, currency) : "—"}
            </TableCell>
            <TableCell>
              {t.result && (
                <Badge variant={t.result === "win" ? "profit" : t.result === "loss" ? "loss" : "default"}>{t.result}</Badge>
              )}
              {!t.result && <Badge variant="warning">{t.status}</Badge>}
            </TableCell>
            <TableCell>
              {t.screenshots.length > 0 ? (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <ImageIcon className="h-3.5 w-3.5" /> {t.screenshots.length}
                </span>
              ) : (
                <ImageOff className="h-3.5 w-3.5 text-muted-foreground/40" />
              )}
            </TableCell>
          </TableRow>
        ))}
        {sorted.length === 0 && (
          <TableRow>
            <TableCell colSpan={10} className="text-center text-sm text-muted-foreground py-10">
              No trades match these filters.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

function SortableHead({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; dir: "asc" | "desc" };
  onSort: (key: SortKey) => void;
}) {
  return (
    <TableHead>
      <button onClick={() => onSort(sortKey)} className="flex items-center gap-1 hover:text-foreground">
        {label}
        <ArrowUpDown className={`h-3 w-3 ${sort.key === sortKey ? "text-accent" : "text-muted-foreground/50"}`} />
      </button>
    </TableHead>
  );
}
