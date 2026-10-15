"use client";
import * as React from "react";
import { X, Plus } from "lucide-react";
import { EMOTION_TAGS } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function EmotionTagPicker({ value, onChange }: { value: string[]; onChange: (tags: string[]) => void }) {
  const [customInput, setCustomInput] = React.useState("");

  function toggle(tag: string) {
    if (value.includes(tag)) onChange(value.filter((t) => t !== tag));
    else onChange([...value, tag]);
  }

  function addCustom() {
    const tag = customInput.trim();
    if (tag && !value.includes(tag)) {
      onChange([...value, tag]);
    }
    setCustomInput("");
  }

  const customTags = value.filter((t) => !EMOTION_TAGS.includes(t as (typeof EMOTION_TAGS)[number]));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {EMOTION_TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => toggle(tag)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              value.includes(tag) ? "bg-accent/15 text-accent border-accent/30" : "border-border text-muted-foreground hover:text-foreground hover:bg-surface-2"
            )}
          >
            {tag}
          </button>
        ))}
        {customTags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => toggle(tag)}
            className="flex items-center gap-1 rounded-full border border-accent/30 bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent"
          >
            {tag}
            <X className="h-3 w-3" />
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          placeholder="Add a custom tag…"
          className="h-8 text-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
        />
        <button type="button" onClick={addCustom} className="flex items-center gap-1 rounded-md border border-border px-2 text-xs text-muted-foreground hover:bg-surface-2">
          <Plus className="h-3 w-3" /> Add
        </button>
      </div>
    </div>
  );
}
