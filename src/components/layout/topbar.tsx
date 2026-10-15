"use client";
import * as React from "react";
import { Layers, Check, ChevronDown, Plus } from "lucide-react";
import { useAccountContext } from "./account-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function Topbar({ title, description }: { title: string; description?: string }) {
  const { accounts, activeAccountId, aggregated, setActiveAccountId, setAggregated } = useAccountContext();
  const active = accounts.find((a) => a.id === activeAccountId);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/80 px-4 py-4 lg:px-8 sticky top-0 z-30 backdrop-blur">
      <div>
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-2 transition-colors">
              <Layers className="h-3.5 w-3.5 text-muted-foreground" />
              {aggregated ? "All Accounts (Aggregated)" : active ? active.name : "Select account"}
              {active && !aggregated && (
                <Badge variant={active.type === "prop_firm" ? "warning" : "accent"}>
                  {active.type === "prop_firm" ? "Prop Firm" : "Personal"}
                </Badge>
              )}
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Accounts</DropdownMenuLabel>
            {accounts.map((a) => (
              <DropdownMenuItem
                key={a.id}
                onClick={() => {
                  setActiveAccountId(a.id);
                  setAggregated(false);
                }}
                className="justify-between"
              >
                <span className="flex items-center gap-2">
                  {a.name}
                  <Badge variant={a.type === "prop_firm" ? "warning" : "accent"}>
                    {a.type === "prop_firm" ? "Prop" : "Personal"}
                  </Badge>
                </span>
                {!aggregated && a.id === activeAccountId && <Check className="h-3.5 w-3.5 text-accent" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setAggregated(true)} className="justify-between">
              All accounts (aggregated view)
              {aggregated && <Check className="h-3.5 w-3.5 text-accent" />}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <a href="/settings" className={cn("flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-surface hover:text-foreground")}>
              <Plus className="h-3.5 w-3.5" /> Manage accounts
            </a>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
