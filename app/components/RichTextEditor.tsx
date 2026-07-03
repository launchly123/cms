"use client";

import * as React from "react";

type Command = () => void;

function ToolbarButton({
  label,
  onCommand,
  className = "",
}: {
  label: string;
  onCommand: Command;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`h-8 rounded px-2.5 text-xs text-foreground transition-colors hover:bg-card-hover ${className}`}
      onMouseDown={(e) => {
        // Prevent the editor from losing focus / selection.
        e.preventDefault();
        onCommand();
      }}
    >
      {label}
    </button>
  );
}

export function RichTextEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const editorRef = React.useRef<HTMLDivElement>(null);
  const initialized = React.useRef(false);

  // Uncontrolled: seed innerHTML from `value` exactly once on mount.
  React.useEffect(() => {
    if (!initialized.current && editorRef.current) {
      editorRef.current.innerHTML = value || "";
      initialized.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emitChange = React.useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const exec = React.useCallback(
    (command: string, arg?: string) => {
      editorRef.current?.focus();
      document.execCommand(command, false, arg);
      emitChange();
    },
    [emitChange]
  );

  const insertLink = React.useCallback(() => {
    const input = window.prompt("Link URL");
    if (!input) return;
    const url = input.trim();
    if (!url) return;
    const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)
      ? url
      : `https://${url}`;
    exec("createLink", withScheme);
  }, [exec]);

  const clearFormatting = React.useCallback(() => {
    editorRef.current?.focus();
    document.execCommand("removeFormat", false);
    document.execCommand("formatBlock", false, "P");
    emitChange();
  }, [emitChange]);

  return (
    <div>
      <div className="flex flex-wrap gap-1 rounded-t-md border border-b-0 border-border bg-card p-1.5">
        <ToolbarButton label="H2" onCommand={() => exec("formatBlock", "H2")} />
        <ToolbarButton label="H3" onCommand={() => exec("formatBlock", "H3")} />
        <ToolbarButton label="B" className="font-bold" onCommand={() => exec("bold")} />
        <ToolbarButton label="I" className="italic" onCommand={() => exec("italic")} />
        <ToolbarButton label="&bull; List" onCommand={() => exec("insertUnorderedList")} />
        <ToolbarButton label="1. List" onCommand={() => exec("insertOrderedList")} />
        <ToolbarButton label="Link" onCommand={insertLink} />
        <ToolbarButton label="Clear" onCommand={clearFormatting} />
      </div>
      <div
        ref={editorRef}
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-label="Post content"
        suppressContentEditableWarning
        onInput={emitChange}
        className="prose-invert min-h-[280px] rounded-b-md border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/30 [&_a]:underline [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2"
      />
    </div>
  );
}
