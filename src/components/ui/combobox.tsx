"use client";
import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export interface ComboboxOption {
  value: string;
  label: string;
  group?: string;
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  allowCustom = false,
  className,
}: {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  allowCustom?: boolean;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const selected = options.find((o) => o.value === value);

  const groups = React.useMemo(() => {
    const map = new Map<string, ComboboxOption[]>();
    for (const opt of options) {
      const g = opt.group ?? "Options";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(opt);
    }
    return Array.from(map.entries());
  }, [options]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-lg border border-border bg-surface-2 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50",
            className
          )}
        >
          <span className={cn(!selected && "text-muted-foreground")}>{selected ? selected.label : value || placeholder}</span>
          <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <CommandPrimitive className="flex flex-col" shouldFilter={true}>
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <CommandPrimitive.Input
              value={query}
              onValueChange={setQuery}
              placeholder={searchPlaceholder}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
          </div>
          <CommandPrimitive.List className="max-h-64 overflow-y-auto scrollbar-thin p-1">
            <CommandPrimitive.Empty className="py-4 text-center text-sm text-muted-foreground">
              {allowCustom && query ? (
                <button
                  className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface"
                  onClick={() => {
                    onChange(query.toUpperCase());
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  Use custom instrument &ldquo;{query.toUpperCase()}&rdquo;
                </button>
              ) : (
                "No matches."
              )}
            </CommandPrimitive.Empty>
            {groups.map(([group, items]) => (
              <CommandPrimitive.Group key={group} heading={group} className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:text-muted-foreground">
                {items.map((opt) => (
                  <CommandPrimitive.Item
                    key={opt.value}
                    value={opt.label}
                    onSelect={() => {
                      onChange(opt.value);
                      setOpen(false);
                      setQuery("");
                    }}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground data-[selected=true]:bg-surface"
                  >
                    <Check className={cn("h-3.5 w-3.5 text-accent", value === opt.value ? "opacity-100" : "opacity-0")} />
                    {opt.label}
                  </CommandPrimitive.Item>
                ))}
              </CommandPrimitive.Group>
            ))}
          </CommandPrimitive.List>
        </CommandPrimitive>
      </PopoverContent>
    </Popover>
  );
}
