"use client";

import * as React from "react";
import { Button, Label, Spinner } from "@/app/components/ui";

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

function friendlyUploadError(status: number, data: { error?: string; details?: unknown }): string {
  if (data.error === "supabase_not_configured") {
    return "Supabase isn't connected yet — add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local and run supabase/schema.sql (see the Websites page for full steps).";
  }
  if (Array.isArray(data.details) && data.details.every((d) => typeof d === "string")) {
    return (data.details as string[]).join(" ");
  }
  if (typeof data.error === "string" && data.error !== "internal_error") {
    return data.error;
  }
  return "Upload failed. Please try again.";
}

export function ImageDropzone({
  websiteId,
  value,
  onChange,
  label,
  endpoint = "/api/upload",
}: {
  websiteId: string;
  value: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  /** Upload endpoint — the client editor uses its own session-scoped route. */
  endpoint?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const dragCounter = React.useRef(0);
  const [dragging, setDragging] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const openPicker = () => inputRef.current?.click();

  const upload = React.useCallback(
    async (file: File) => {
      setError(null);

      if (!file.type.startsWith("image/")) {
        setError("That file isn't an image. Please choose a PNG, JPG, GIF, WebP or SVG.");
        return;
      }
      if (file.size > MAX_SIZE_BYTES) {
        setError("That image is too large. Please choose a file under 10MB.");
        return;
      }

      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("websiteId", websiteId);

        const res = await fetch(endpoint, { method: "POST", body: formData });
        const data = await res.json().catch(() => ({}));

        if (!res.ok || typeof data.url !== "string") {
          setError(friendlyUploadError(res.status, data));
          return;
        }
        onChange(data.url);
      } catch {
        setError("Upload failed. Please check your connection and try again.");
      } finally {
        setUploading(false);
      }
    },
    [websiteId, onChange, endpoint]
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setDragging(false);
    if (uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void upload(file);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current += 1;
    setDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) setDragging(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void upload(file);
    // Allow re-selecting the same file later.
    e.target.value = "";
  };

  return (
    <div>
      {label && <Label>{label}</Label>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleInputChange}
        aria-hidden="true"
        tabIndex={-1}
      />

      {value && !uploading ? (
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt={label ?? "Uploaded image"}
            className="max-h-48 rounded-md border border-border object-cover"
          />
          <div className="mt-2 flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              className="h-7 px-2.5 text-xs"
              onClick={openPicker}
            >
              Replace
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-7 px-2.5 text-xs"
              onClick={() => {
                setError(null);
                onChange(null);
              }}
            >
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          aria-label={label ? `Upload ${label.toLowerCase()}` : "Upload image"}
          onClick={() => !uploading && openPicker()}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !uploading) {
              e.preventDefault();
              openPicker();
            }
          }}
          onDragOver={(e) => e.preventDefault()}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed px-4 py-6 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-foreground/30 ${
            dragging
              ? "border-foreground/60 bg-card-hover"
              : "border-border hover:bg-card-hover"
          }`}
        >
          {uploading ? (
            <span className="flex items-center gap-2 text-muted">
              <Spinner className="h-4 w-4" />
              Uploading…
            </span>
          ) : (
            <span className="text-muted">Drag &amp; drop an image, or click to browse</span>
          )}
        </div>
      )}

      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
