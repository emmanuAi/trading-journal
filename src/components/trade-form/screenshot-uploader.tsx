"use client";
import * as React from "react";
import { toast } from "sonner";
import { Upload, X, Maximize2 } from "lucide-react";
import type { Screenshot } from "@/lib/types";
import { cn } from "@/lib/utils";

function screenshotUrl(filePath: string) {
  return `/api/screenshots/file/${filePath}`;
}

export function ScreenshotSection({
  tradeId,
  phase,
  label,
  screenshots,
  onChange,
}: {
  tradeId: string;
  phase: "before" | "during" | "after";
  label: string;
  screenshots: Screenshot[];
  onChange: () => void;
}) {
  const [dragOver, setDragOver] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [preview, setPreview] = React.useState<Screenshot | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function upload(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    const invalid = list.find((f) => !["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(f.type));
    if (invalid) {
      toast.error(`Unsupported file type: ${invalid.type || invalid.name}. Use JPG, PNG or WebP.`);
      return;
    }
    setUploading(true);
    const formData = new FormData();
    formData.set("phase", phase);
    list.forEach((f) => formData.append("files", f));
    const res = await fetch(`/api/trades/${tradeId}/screenshots`, { method: "POST", body: formData });
    setUploading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Upload failed." }));
      toast.error(data.error ?? "Upload failed.");
      return;
    }
    toast.success(`${list.length} screenshot${list.length > 1 ? "s" : ""} uploaded.`);
    onChange();
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/screenshots/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to delete screenshot.");
      return;
    }
    setPreview(null);
    onChange();
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-muted">{label}</span>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          upload(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed p-4 text-center cursor-pointer transition-colors",
          dragOver ? "border-accent bg-accent/5" : "border-border hover:bg-surface-2/50"
        )}
      >
        <Upload className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          {uploading ? "Uploading…" : "Drag & drop or click to upload (JPG, PNG, WebP)"}
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) upload(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {screenshots.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {screenshots.map((s) => (
            <div key={s.id} className="group relative aspect-video overflow-hidden rounded-md border border-border bg-surface-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={screenshotUrl(s.filePath)} alt={s.originalName} className="h-full w-full object-cover" />
              <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/0 opacity-0 transition-opacity group-hover:bg-black/50 group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => setPreview(s)}
                  className="rounded-md bg-black/60 p-1.5 text-white hover:bg-black/80"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(s.id)}
                  className="rounded-md bg-black/60 p-1.5 text-white hover:bg-loss"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {preview && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-6"
          onClick={() => setPreview(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={screenshotUrl(preview.filePath)} alt={preview.originalName} className="max-h-full max-w-full rounded-lg object-contain" />
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
