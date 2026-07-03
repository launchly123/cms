"use client";

import * as React from "react";

/**
 * In-place editable text for the visual editor.
 * Uncontrolled contentEditable that syncs from state only while unfocused,
 * so typing is never interrupted but panel edits still flow in.
 */
export function EditableText({
  value,
  onChange,
  onSelect,
  as = "p",
  className = "",
  placeholder = "Click to add text",
  multiline = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect?: () => void;
  as?: "h1" | "h2" | "h3" | "p" | "span";
  className?: string;
  placeholder?: string;
  multiline?: boolean;
}) {
  const ref = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && (el.textContent ?? "") !== value) {
      el.textContent = value;
    }
  }, [value]);

  const Tag = as as React.ElementType;
  return (
    <Tag
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      spellCheck={false}
      onInput={(e: React.FormEvent<HTMLElement>) =>
        onChange(e.currentTarget.textContent ?? "")
      }
      onFocus={() => onSelect?.()}
      onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
        if (!multiline && e.key === "Enter") {
          e.preventDefault();
          (e.currentTarget as HTMLElement).blur();
        }
      }}
      className={`editable-text cursor-text rounded-sm outline-none transition-shadow hover:ring-2 hover:ring-sky-400/50 focus:ring-2 focus:ring-sky-500 ${className}`}
    />
  );
}

/**
 * In-place editable image. Click selects it; the right panel handles
 * replace/remove via the upload dropzone.
 */
export function EditableImage({
  src,
  alt,
  className = "",
  emptyLabel = "Click to add an image",
  onSelect,
  selected = false,
}: {
  src: string | null;
  alt: string;
  className?: string;
  emptyLabel?: string;
  onSelect: () => void;
  selected?: boolean;
}) {
  const ring = selected
    ? "ring-2 ring-sky-500"
    : "hover:ring-2 hover:ring-sky-400/50";
  if (!src) {
    return (
      <button
        type="button"
        onClick={onSelect}
        className={`flex min-h-40 w-full cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 text-sm text-gray-400 transition-shadow hover:bg-gray-100 ${ring} ${className}`}
      >
        {emptyLabel}
      </button>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      onClick={onSelect}
      className={`cursor-pointer rounded-xl object-cover transition-shadow ${ring} ${className}`}
    />
  );
}
