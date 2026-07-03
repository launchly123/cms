"use client";

import * as React from "react";
import type { PageDraft, PostDraft } from "@/lib/types";
import { EditableText, EditableImage } from "./editable";
import type { Selection } from "./selection";

/**
 * White "live site" canvas rendering the page roughly as the starter
 * template does, with every content element editable in place.
 */
export function PageCanvas({
  form,
  update,
  updateSection,
  addSection,
  removeSection,
  select,
  selected,
}: {
  form: PageDraft;
  update: (patch: Partial<PageDraft>) => void;
  updateSection: (id: string, patch: Partial<PageDraft["content"][number]>) => void;
  addSection: () => void;
  removeSection: (id: string) => void;
  select: (sel: Selection) => void;
  selected: Selection | null;
}) {
  return (
    <div className="min-h-full bg-white font-sans text-gray-900">
      {/* Hero */}
      <section className="mx-auto max-w-5xl px-8 py-16">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <EditableText
              as="h1"
              value={form.hero_heading ?? ""}
              placeholder="Your headline goes here"
              onChange={(v) => update({ hero_heading: v })}
              onSelect={() =>
                select({ kind: "text", label: "Hero heading", target: "page", field: "hero_heading" })
              }
              className="text-4xl font-bold tracking-tight md:text-5xl"
            />
            <EditableText
              as="p"
              multiline
              value={form.hero_subheading ?? ""}
              placeholder="A short supporting sentence about this site."
              onChange={(v) => update({ hero_subheading: v })}
              onSelect={() =>
                select({ kind: "text", label: "Hero subheading", target: "page", field: "hero_subheading", multiline: true })
              }
              className="mt-4 text-lg text-gray-600"
            />
          </div>
          <EditableImage
            src={form.hero_image_url}
            alt="Hero"
            emptyLabel="Click to add a hero image"
            onSelect={() =>
              select({ kind: "image", label: "Hero image", target: "page", field: "hero_image_url" })
            }
            selected={selected?.kind === "image" && selected.target === "page"}
            className="aspect-[4/3] w-full shadow-lg"
          />
        </div>
      </section>

      {/* Content sections */}
      <div className="mx-auto max-w-3xl px-8 pb-16">
        {form.content.map((s) => (
          <section key={s.id} className="group relative border-t border-gray-100 py-10">
            <button
              type="button"
              onClick={() => removeSection(s.id)}
              className="absolute right-0 top-3 rounded-md px-2 py-1 text-xs text-gray-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
            >
              ✕ Remove section
            </button>
            <EditableText
              as="h2"
              value={s.heading}
              placeholder="Section heading"
              onChange={(v) => updateSection(s.id, { heading: v })}
              onSelect={() =>
                select({ kind: "text", label: "Section heading", target: "section", sectionId: s.id, field: "heading" })
              }
              className="mb-3 text-2xl font-semibold"
            />
            {s.image_url !== undefined && (
              <div className="mb-4">
                <EditableImage
                  src={s.image_url ?? null}
                  alt={s.heading}
                  emptyLabel="Click to add an image (optional)"
                  onSelect={() =>
                    select({ kind: "image", label: "Section image", target: "section", sectionId: s.id, field: "image_url" })
                  }
                  selected={
                    selected?.kind === "image" &&
                    selected.target === "section" &&
                    selected.sectionId === s.id
                  }
                  className="max-h-80 w-full"
                />
              </div>
            )}
            <EditableText
              as="p"
              multiline
              value={s.body}
              placeholder="Write this section's text…"
              onChange={(v) => updateSection(s.id, { body: v })}
              onSelect={() =>
                select({ kind: "text", label: "Section text", target: "section", sectionId: s.id, field: "body", multiline: true })
              }
              className="whitespace-pre-wrap leading-relaxed text-gray-700"
            />
          </section>
        ))}

        <button
          type="button"
          onClick={addSection}
          className="mt-6 w-full rounded-xl border-2 border-dashed border-gray-200 py-4 text-sm text-gray-400 transition-colors hover:border-gray-300 hover:text-gray-600"
        >
          + Add section
        </button>
      </div>
    </div>
  );
}

/** Editable blog article canvas: title, featured image, rich HTML body. */
export function PostCanvas({
  form,
  update,
  select,
  selected,
}: {
  form: PostDraft;
  update: (patch: Partial<PostDraft>) => void;
  select: (sel: Selection) => void;
  selected: Selection | null;
}) {
  const bodyRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = bodyRef.current;
    if (el && document.activeElement !== el && el.innerHTML !== form.content) {
      el.innerHTML = form.content || "";
    }
  }, [form.content]);

  const exec = (command: string, arg?: string) => {
    bodyRef.current?.focus();
    document.execCommand(command, false, arg);
    if (bodyRef.current) update({ content: bodyRef.current.innerHTML });
  };

  const toolbarBtn =
    "rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 transition-colors";

  return (
    <div className="min-h-full bg-white font-sans text-gray-900">
      <article className="mx-auto max-w-2xl px-8 py-16">
        <EditableText
          as="h1"
          value={form.title}
          placeholder="Article title"
          onChange={(v) => update({ title: v })}
          onSelect={() => select({ kind: "text", label: "Article title", target: "post", field: "title" })}
          className="text-4xl font-bold tracking-tight"
        />
        <EditableText
          as="p"
          multiline
          value={form.excerpt ?? ""}
          placeholder="Short summary shown in the blog list (optional)"
          onChange={(v) => update({ excerpt: v })}
          onSelect={() =>
            select({ kind: "text", label: "Excerpt", target: "post", field: "excerpt", multiline: true })
          }
          className="mt-3 text-lg text-gray-500"
        />

        <div className="mt-8">
          <EditableImage
            src={form.featured_image_url}
            alt={form.title}
            emptyLabel="Click to add a featured image"
            onSelect={() =>
              select({ kind: "image", label: "Featured image", target: "post", field: "featured_image_url" })
            }
            selected={selected?.kind === "image" && selected.target === "post"}
            className="aspect-video w-full"
          />
        </div>

        {/* Rich text body */}
        <div className="sticky top-2 z-10 mt-8 flex w-fit gap-0.5 rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
          <button type="button" className={`${toolbarBtn} font-bold`} onMouseDown={(e) => { e.preventDefault(); exec("bold"); }}>B</button>
          <button type="button" className={`${toolbarBtn} italic`} onMouseDown={(e) => { e.preventDefault(); exec("italic"); }}>I</button>
          <button type="button" className={toolbarBtn} onMouseDown={(e) => { e.preventDefault(); exec("formatBlock", "H2"); }}>H2</button>
          <button type="button" className={toolbarBtn} onMouseDown={(e) => { e.preventDefault(); exec("formatBlock", "H3"); }}>H3</button>
          <button type="button" className={toolbarBtn} onMouseDown={(e) => { e.preventDefault(); exec("insertUnorderedList"); }}>• List</button>
          <button type="button" className={toolbarBtn} onMouseDown={(e) => { e.preventDefault(); exec("insertOrderedList"); }}>1. List</button>
          <button
            type="button"
            className={toolbarBtn}
            onMouseDown={(e) => {
              e.preventDefault();
              const input = window.prompt("Link URL");
              if (!input?.trim()) return;
              const url = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(input.trim())
                ? input.trim()
                : `https://${input.trim()}`;
              exec("createLink", url);
            }}
          >
            Link
          </button>
        </div>
        <div
          ref={bodyRef}
          contentEditable
          suppressContentEditableWarning
          data-placeholder="Write your article here…"
          onInput={(e) => update({ content: e.currentTarget.innerHTML })}
          className="editable-text prose-none mt-4 min-h-[300px] rounded-sm leading-relaxed outline-none transition-shadow hover:ring-2 hover:ring-sky-400/40 focus:ring-2 focus:ring-sky-500 [&_a]:text-blue-600 [&_a]:underline [&_h2]:mt-6 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:text-xl [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_ul]:list-disc [&_ul]:pl-6"
        />
      </article>
    </div>
  );
}
