"use client";
import * as React from "react";
import { toast } from "sonner";
import { Upload, X, Maximize2, Clipboard } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Screenshot } from "@/lib/types";

export type ScreenshotPhase = Screenshot["phase"];

export interface StagedScreenshot {
  localId: string;
  phase: ScreenshotPhase;
  file: File;
  previewUrl: string;
}

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const CATEGORIES: { phase: ScreenshotPhase; label: string }[] = [
  { phase: "before", label: "Before Entry" },
  { phase: "during", label: "During Trade" },
  { phase: "after", label: "After Exit" },
];

function makeStaged(file: File, phase: ScreenshotPhase): StagedScreenshot {
  return {
    localId: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    phase,
    file,
    previewUrl: URL.createObjectURL(file),
  };
}

/** Revokes object URLs for screenshots that are being removed, so memory doesn't leak as trades are staged and re-staged. */
export function revokeStagedScreenshots(staged: StagedScreenshot[]) {
  for (const s of staged) URL.revokeObjectURL(s.previewUrl);
}

export function StagedScreenshotsPanel({
  staged,
  onChange,
}: {
  staged: StagedScreenshot[];
  onChange: (next: StagedScreenshot[]) => void;
}) {
  const [activeCategory, setActiveCategory] = React.useState<ScreenshotPhase>("before");
  const [preview, setPreview] = React.useState<StagedScreenshot | null>(null);

  const addFiles = React.useCallback(
    (files: File[] | FileList, phase: ScreenshotPhase) => {
      const list = Array.from(files);
      if (list.length === 0) return;
      const invalid = list.find((f) => !ALLOWED_TYPES.includes(f.type));
      if (invalid) {
        toast.error(`Unsupported file type: ${invalid.type || invalid.name}. Use JPG, PNG or WebP.`);
        return;
      }
      const next = list.map((f) => makeStaged(f, phase));
      onChange([...staged, ...next]);
      toast.success(`${next.length} screenshot${next.length > 1 ? "s" : ""} added to ${CATEGORIES.find((c) => c.phase === phase)?.label}.`);
    },
    [staged, onChange]
  );

  const removeOne = React.useCallback(
    (localId: string) => {
      const target = staged.find((s) => s.localId === localId);
      if (target) URL.revokeObjectURL(target.previewUrl);
      onChange(staged.filter((s) => s.localId !== localId));
      setPreview((p) => (p?.localId === localId ? null : p));
    },
    [staged, onChange]
  );

  // Clipboard paste support — only active while this panel is mounted, i.e. only while the
  // Screenshots tab is the one showing. Only intercepts when the clipboard actually carries an
  // image, so pasting text into notes elsewhere in the app is never affected.
  React.useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageFiles: File[] = [];
      for (const item of items) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length === 0) return;
      e.preventDefault();
      addFiles(imageFiles, activeCategory);
    }
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [activeCategory, addFiles]);

  return (
    <div className="flex flex-col gap-5">
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Clipboard className="h-3.5 w-3.5" />
        Hover a category and press <kbd className="rounded border border-border bg-surface-2 px-1 py-0.5 text-[10px]">Ctrl+V</kbd> to paste a chart straight from TradingView — or drag &amp; drop, or browse.
      </p>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {CATEGORIES.map((cat) => (
          <StagedCategorySection
            key={cat.phase}
            label={cat.label}
            screenshots={staged.filter((s) => s.phase === cat.phase)}
            isActive={activeCategory === cat.phase}
            onFocusCategory={() => setActiveCategory(cat.phase)}
            onAddFiles={(files) => addFiles(files, cat.phase)}
            onRemove={removeOne}
            onPreview={setPreview}
          />
        ))}
      </div>

      {preview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-6" onClick={() => setPreview(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview.previewUrl} alt={preview.file.name} className="max-h-full max-w-full rounded-lg object-contain" />
          <button
            type="button"
            onClick={() => setPreview(null)}
            className="absolute right-6 top-6 rounded-md bg-surface-2 p-2 text-foreground hover:bg-surface"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}

function StagedCategorySection({
  label,
  screenshots,
  isActive,
  onFocusCategory,
  onAddFiles,
  onRemove,
  onPreview,
}: {
  label: string;
  screenshots: StagedScreenshot[];
  isActive: boolean;
  onFocusCategory: () => void;
  onAddFiles: (files: File[] | FileList) => void;
  onRemove: (localId: string) => void;
  onPreview: (s: StagedScreenshot) => void;
}) {
  const [dragOver, setDragOver] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
        {label}
        {screenshots.length > 0 && <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] text-accent">{screenshots.length}</span>}
      </span>
      <div
        tabIndex={0}
        role="button"
        aria-label={`Add screenshot to ${label}`}
        onMouseEnter={onFocusCategory}
        onFocus={onFocusCategory}
        onDragOver={(e) => {
          e.preventDefault();
          onFocusCategory();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          onAddFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed p-4 text-center cursor-pointer transition-colors outline-none",
          dragOver ? "border-accent bg-accent/5" : isActive ? "border-accent/50 bg-accent/[0.03]" : "border-border hover:bg-surface-2/50"
        )}
      >
        <Upload className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Drag &amp; drop, click to browse, or paste</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) onAddFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {screenshots.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {screenshots.map((s) => (
            <div key={s.localId} className="group relative aspect-video overflow-hidden rounded-md border border-border bg-surface-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.previewUrl} alt={s.file.name} className="h-full w-full object-cover" />
              <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/0 opacity-0 transition-opacity group-hover:bg-black/50 group-hover:opacity-100">
                <button type="button" onClick={() => onPreview(s)} className="rounded-md bg-black/60 p-1.5 text-white hover:bg-black/80">
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => onRemove(s.localId)} className="rounded-md bg-black/60 p-1.5 text-white hover:bg-loss">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
