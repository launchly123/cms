"use client";

import * as React from "react";
import Link from "next/link";
import type { BlogPost, Page, PageDraft, PostDraft, Website } from "@/lib/types";
import { Banner, Button, Spinner, useFlash } from "@/app/components/ui";
import { ImageDropzone } from "@/app/components/ImageDropzone";
import { PageCanvas, PostCanvas } from "./Canvas";
import { LiveSiteCanvas } from "./LiveSiteCanvas";
import { SeoPanel } from "./SeoPanel";
import { Tutorial, useTutorial } from "./Tutorial";
import type { Selection } from "./selection";

type Role = "owner" | "client";
type DocRef = { type: "page" | "post"; id: string };

interface Bundle {
  website: {
    id: string;
    name: string;
    slug: string;
    domain: string | null;
    status: string;
  };
  role: Role;
  pages: Page[];
  posts: BlogPost[];
}

function toPageForm(page: Page): PageDraft {
  const d = page.draft;
  return {
    title: d?.title ?? page.title,
    hero_heading: d?.hero_heading ?? page.hero_heading,
    hero_subheading: d?.hero_subheading ?? page.hero_subheading,
    hero_image_url: d?.hero_image_url ?? page.hero_image_url,
    content: (d?.content ?? page.content ?? []).map((s) => ({
      id: s.id,
      heading: s.heading ?? "",
      body: s.body ?? "",
      image_url: s.image_url ?? null,
    })),
    seo_title: d?.seo_title ?? page.seo_title,
    seo_description: d?.seo_description ?? page.seo_description,
    seo_keyphrase: d?.seo_keyphrase ?? page.seo_keyphrase ?? null,
    overrides: d?.overrides ?? page.content_overrides ?? {},
  };
}

function toPostForm(post: BlogPost): PostDraft {
  const d = post.draft;
  return {
    title: d?.title ?? post.title,
    excerpt: d?.excerpt ?? post.excerpt,
    content: d?.content ?? post.content,
    featured_image_url: d?.featured_image_url ?? post.featured_image_url,
  };
}

const DEVICES = [
  { key: "desktop", label: "Desktop", width: "100%", icon: "🖥" },
  { key: "tablet", label: "Tablet", width: "768px", icon: "▯" },
  { key: "mobile", label: "Phone", width: "390px", icon: "▮" },
] as const;

export function Editor({ slug, role }: { slug: string; role: Role }) {
  const [bundle, setBundle] = React.useState<Bundle | null>(null);
  const [allSites, setAllSites] = React.useState<Website[]>([]);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [doc, setDoc] = React.useState<DocRef | null>(null);
  const [pageForm, setPageForm] = React.useState<PageDraft | null>(null);
  const [postForm, setPostForm] = React.useState<PostDraft | null>(null);
  const [snapshot, setSnapshot] = React.useState("");

  const [selected, setSelected] = React.useState<Selection | null>(null);
  const [device, setDevice] = React.useState<(typeof DEVICES)[number]>(DEVICES[0]);
  const [seoOpen, setSeoOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [flash, setFlash] = useFlash();

  const [aiInstruction, setAiInstruction] = React.useState("");
  const [aiBusy, setAiBusy] = React.useState(false);

  const tutorial = useTutorial(bundle?.website.id ?? null);

  const currentPage = doc?.type === "page" ? bundle?.pages.find((p) => p.id === doc.id) : undefined;
  const currentPost = doc?.type === "post" ? bundle?.posts.find((p) => p.id === doc.id) : undefined;
  const form = doc?.type === "page" ? pageForm : postForm;
  const dirty = form !== null && JSON.stringify(form) !== snapshot;

  const openDoc = React.useCallback(
    (ref: DocRef, b: Bundle) => {
      setSelected(null);
      setSeoOpen(false);
      setDoc(ref);
      if (ref.type === "page") {
        const page = b.pages.find((p) => p.id === ref.id);
        const f = page ? toPageForm(page) : null;
        setPageForm(f);
        setPostForm(null);
        setSnapshot(JSON.stringify(f));
      } else {
        const post = b.posts.find((p) => p.id === ref.id);
        const f = post ? toPostForm(post) : null;
        setPostForm(f);
        setPageForm(null);
        setSnapshot(JSON.stringify(f));
      }
    },
    []
  );

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/client/sites/${slug}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setLoadError(
            data.error === "supabase_not_configured"
              ? "The CMS isn't connected to Supabase yet."
              : "Couldn't load this website. Refresh to try again."
          );
          return;
        }
        const b = data as Bundle;
        setBundle(b);
        const first = b.pages.find((p) => p.slug === "home") ?? b.pages[0];
        if (first) openDoc({ type: "page", id: first.id }, b);
        else if (b.posts[0]) openDoc({ type: "post", id: b.posts[0].id }, b);
      } catch {
        if (!cancelled) setLoadError("Couldn't load this website. Refresh to try again.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, openDoc]);

  React.useEffect(() => {
    if (role !== "owner") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/websites");
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok) setAllSites(data.websites ?? []);
      } catch {
        /* site switcher is optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [role]);

  function switchDoc(value: string) {
    if (!bundle) return;
    if (dirty && !window.confirm("You have unsaved changes. Discard them?")) return;
    const [type, id] = value.split(":") as ["page" | "post", string];
    openDoc({ type, id }, bundle);
  }

  async function createDoc(type: "page" | "post") {
    if (!bundle) return;
    const title = window.prompt(type === "page" ? "Page title" : "Article title");
    if (!title?.trim()) return;
    if (dirty && !window.confirm("You have unsaved changes. Discard them?")) return;
    setError(null);
    try {
      const res = await fetch(
        `/api/client/sites/${slug}/${type === "page" ? "pages" : "posts"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title.trim() }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Couldn't create it.");
        return;
      }
      const next: Bundle =
        type === "page"
          ? { ...bundle, pages: [...bundle.pages, data.page] }
          : { ...bundle, posts: [data.post, ...bundle.posts] };
      setBundle(next);
      openDoc({ type, id: type === "page" ? data.page.id : data.post.id }, next);
      setFlash(type === "page" ? "Page created" : "Article created");
    } catch {
      setError("Couldn't create it. Please try again.");
    }
  }

  async function saveDraft(): Promise<boolean> {
    if (!doc || !form || !bundle) return false;
    setSaving(true);
    setError(null);
    try {
      const url =
        doc.type === "page"
          ? `/api/client/sites/${slug}/pages/${doc.id}`
          : `/api/client/sites/${slug}/posts/${doc.id}`;
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Couldn't save.");
        return false;
      }
      setBundle((b) =>
        b
          ? doc.type === "page"
            ? { ...b, pages: b.pages.map((p) => (p.id === doc.id ? data.page : p)) }
            : { ...b, posts: b.posts.map((p) => (p.id === doc.id ? data.post : p)) }
          : b
      );
      setSnapshot(JSON.stringify(form));
      setFlash("Draft saved");
      return true;
    } catch {
      setError("Couldn't save. Check your connection.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    if (!doc) return;
    setPublishing(true);
    setError(null);
    try {
      if (dirty) {
        const ok = await saveDraft();
        if (!ok) return;
      }
      const url =
        doc.type === "page"
          ? `/api/client/sites/${slug}/pages/${doc.id}/publish`
          : `/api/client/sites/${slug}/posts/${doc.id}/publish`;
      const res = await fetch(url, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Couldn't publish.");
        return;
      }
      setBundle((b) =>
        b
          ? doc.type === "page"
            ? { ...b, pages: b.pages.map((p) => (p.id === doc.id ? data.page : p)) }
            : { ...b, posts: b.posts.map((p) => (p.id === doc.id ? data.post : p)) }
          : b
      );
      setFlash(data.revalidated ? "Published — live site updated ✓" : "Published ✓");
    } catch {
      setError("Couldn't publish. Please try again.");
    } finally {
      setPublishing(false);
    }
  }

  async function runAiEdit() {
    if (!pageForm || doc?.type !== "page" || !aiInstruction.trim()) return;
    setAiBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/client/sites/${slug}/ai-edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: aiInstruction.trim(), page: pageForm }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "The AI edit failed.");
        return;
      }
      setPageForm(data.page);
      setAiInstruction("");
      setFlash("AI applied your change — review it, then Save");
    } catch {
      setError("Couldn't reach the AI. Check your connection.");
    } finally {
      setAiBusy(false);
    }
  }

  /* ---- selection helpers (read/write the selected element's value) ---- */

  function getSelValue(sel: Selection): string | null {
    if (sel.target === "page" && pageForm) {
      return (pageForm[sel.field] as string | null) ?? "";
    }
    if (sel.target === "section" && pageForm) {
      const s = pageForm.content.find((x) => x.id === sel.sectionId);
      return s ? ((s[sel.field] as string | null) ?? "") : "";
    }
    if (sel.target === "post" && postForm) {
      return (postForm[sel.field] as string | null) ?? "";
    }
    return "";
  }

  function setSelValue(sel: Selection, v: string | null) {
    if (sel.target === "page") {
      setPageForm((f) => (f ? { ...f, [sel.field]: v } : f));
    } else if (sel.target === "section") {
      setPageForm((f) =>
        f
          ? {
              ...f,
              content: f.content.map((s) =>
                s.id === sel.sectionId ? { ...s, [sel.field]: v } : s
              ),
            }
          : f
      );
    } else {
      setPostForm((f) => (f ? { ...f, [sel.field]: v } : f));
    }
  }

  /* ---- status ---- */

  let statusChip: { text: string; cls: string } | null = null;
  if (doc?.type === "page" && currentPage) {
    statusChip = dirty
      ? { text: "Unsaved changes", cls: "text-amber-400" }
      : currentPage.draft
        ? { text: "Draft saved — not live yet", cls: "text-amber-400" }
        : { text: "✓ Published", cls: "text-emerald-400" };
  } else if (doc?.type === "post" && currentPost) {
    statusChip = dirty
      ? { text: "Unsaved changes", cls: "text-amber-400" }
      : !currentPost.published
        ? { text: "Draft — not on the site", cls: "text-muted" }
        : currentPost.draft
          ? { text: "Live — has unpublished edits", cls: "text-amber-400" }
          : { text: "✓ Published", cls: "text-emerald-400" };
  }

  /* ---- render ---- */

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <Banner kind="error">{loadError}</Banner>
      </div>
    );
  }

  if (!bundle) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  const selectBase =
    "h-8 rounded-md border border-border bg-card px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/30";

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* ---------- Top bar ---------- */}
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2">
        <span className="px-1 text-xs font-bold uppercase tracking-widest text-muted">
          Editor
        </span>

        {role === "owner" && allSites.length > 0 ? (
          <select
            className={selectBase}
            value={slug}
            onChange={(e) => {
              if (dirty && !window.confirm("You have unsaved changes. Discard them?")) return;
              window.location.href = `/edit/${e.target.value}`;
            }}
          >
            {allSites.map((s) => (
              <option key={s.id} value={s.slug}>
                {s.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="rounded-md border border-border px-2 py-1 text-sm font-medium">
            {bundle.website.name}
          </span>
        )}

        <select
          className={selectBase}
          value={doc ? `${doc.type}:${doc.id}` : ""}
          onChange={(e) => switchDoc(e.target.value)}
        >
          <optgroup label="Pages">
            {bundle.pages.map((p) => (
              <option key={p.id} value={`page:${p.id}`}>
                {p.title}
              </option>
            ))}
          </optgroup>
          <optgroup label="Articles">
            {bundle.posts.map((p) => (
              <option key={p.id} value={`post:${p.id}`}>
                {p.title} {p.published ? "" : "(draft)"}
              </option>
            ))}
          </optgroup>
        </select>

        <button
          type="button"
          onClick={() => createDoc("page")}
          className="h-8 rounded-md border border-border px-2.5 text-xs text-muted transition-colors hover:bg-card-hover hover:text-foreground"
        >
          + Page
        </button>
        <button
          type="button"
          onClick={() => createDoc("post")}
          className="h-8 rounded-md border border-border px-2.5 text-xs text-muted transition-colors hover:bg-card-hover hover:text-foreground"
        >
          + Article
        </button>

        {/* Device toggle */}
        <div className="mx-auto flex items-center gap-0.5 rounded-md border border-border p-0.5">
          {DEVICES.map((d) => (
            <button
              key={d.key}
              type="button"
              title={d.label}
              onClick={() => setDevice(d)}
              className={`rounded px-2.5 py-1 text-xs transition-colors ${
                device.key === d.key
                  ? "bg-card-hover text-foreground"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        {doc?.type === "page" && (
          <button
            type="button"
            onClick={() => setSeoOpen(true)}
            className="h-8 rounded-md border border-border px-3 text-sm text-muted transition-colors hover:bg-card-hover hover:text-foreground"
          >
            SEO
          </button>
        )}

        {statusChip && (
          <span className={`px-1 text-xs ${statusChip.cls}`}>{statusChip.text}</span>
        )}

        <Button
          variant="ghost"
          className="h-8"
          disabled={!dirty}
          loading={saving && !publishing}
          onClick={saveDraft}
        >
          Save
        </Button>
        <Button className="h-8" loading={publishing} onClick={publish}>
          Publish
        </Button>

        <button
          type="button"
          onClick={tutorial.reopen}
          title="How to use this editor"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-sm text-muted transition-colors hover:bg-card-hover hover:text-foreground"
        >
          ?
        </button>

        {role === "owner" && (
          <Link
            href="/"
            className="ml-1 text-xs text-muted transition-colors hover:text-foreground"
          >
            Dashboard →
          </Link>
        )}
      </header>

      {/* ---------- Body ---------- */}
      <div className="flex min-h-0 flex-1">
        {/* Canvas */}
        <div className="relative min-w-0 flex-1 overflow-y-auto bg-background p-4 md:p-8">
          {(flash || error) && (
            <div className="pointer-events-auto sticky top-0 z-20 mx-auto mb-4 max-w-md">
              {flash && <Banner kind="success">{flash}</Banner>}
              {error && (
                <Banner kind="error" onDismiss={() => setError(null)}>
                  {error}
                </Banner>
              )}
            </div>
          )}

          <div
            className="mx-auto min-h-full overflow-hidden rounded-xl shadow-2xl transition-all duration-300"
            style={{ width: device.width, maxWidth: "100%" }}
          >
            {doc?.type === "page" && pageForm && bundle.website.domain && (
              <LiveSiteCanvas
                slug={slug}
                pageId={doc.id}
                form={pageForm}
                update={(patch) => setPageForm((f) => (f ? { ...f, ...patch } : f))}
              />
            )}

            {doc?.type === "page" && pageForm && !bundle.website.domain && (
              <PageCanvas
                form={pageForm}
                update={(patch) => setPageForm((f) => (f ? { ...f, ...patch } : f))}
                updateSection={(id, patch) =>
                  setPageForm((f) =>
                    f
                      ? {
                          ...f,
                          content: f.content.map((s) =>
                            s.id === id ? { ...s, ...patch } : s
                          ),
                        }
                      : f
                  )
                }
                addSection={() =>
                  setPageForm((f) =>
                    f
                      ? {
                          ...f,
                          content: [
                            ...f.content,
                            { id: crypto.randomUUID(), heading: "", body: "", image_url: null },
                          ],
                        }
                      : f
                  )
                }
                removeSection={(id) => {
                  if (!window.confirm("Remove this section?")) return;
                  setPageForm((f) =>
                    f ? { ...f, content: f.content.filter((s) => s.id !== id) } : f
                  );
                  setSelected(null);
                }}
                select={setSelected}
                selected={selected}
              />
            )}

            {doc?.type === "post" && postForm && (
              <PostCanvas
                form={postForm}
                update={(patch) => setPostForm((f) => (f ? { ...f, ...patch } : f))}
                select={setSelected}
                selected={selected}
              />
            )}

            {!doc && (
              <div className="flex min-h-64 items-center justify-center bg-white p-10 text-center text-gray-500">
                No pages yet — click “+ Page” above to create your first page.
              </div>
            )}
          </div>
        </div>

        {/* Right panel */}
        <aside className="hidden w-80 shrink-0 flex-col border-l border-border bg-card md:flex">
          <div className="flex-1 overflow-y-auto p-4">
            {selected ? (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <span className="rounded bg-card-hover px-2 py-0.5 text-xs font-medium uppercase tracking-wider text-muted">
                    {selected.label}
                  </span>
                  <button
                    onClick={() => setSelected(null)}
                    className="rounded p-1 text-muted hover:bg-card-hover hover:text-foreground"
                    aria-label="Deselect"
                  >
                    ✕
                  </button>
                </div>

                {selected.kind === "text" ? (
                  <>
                    <label className="mb-1.5 block text-sm font-medium">Text</label>
                    <textarea
                      rows={selected.multiline ? 6 : 3}
                      value={getSelValue(selected) ?? ""}
                      onChange={(e) => setSelValue(selected, e.target.value)}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/30"
                    />
                    <p className="mt-1.5 text-xs text-muted">
                      Edit here if it&apos;s hard to click on the page. Bounded so
                      it can&apos;t break the layout.
                    </p>
                  </>
                ) : (
                  <ImageDropzone
                    label="Image"
                    websiteId={bundle.website.id}
                    endpoint={`/api/client/sites/${slug}/upload`}
                    value={getSelValue(selected)}
                    onChange={(url) => setSelValue(selected, url)}
                  />
                )}
              </div>
            ) : (
              <div className="text-sm leading-relaxed text-muted">
                <p className="mb-1 text-xs font-bold uppercase tracking-widest">
                  <span className="text-violet-400">●</span> Editor
                </p>
                <p>
                  Editing <span className="font-semibold text-foreground">{bundle.website.name}</span>.
                  Click any text on the page to change it, or click an image to
                  swap it. <span className="text-foreground">Save</span> keeps a
                  draft; <span className="text-foreground">Publish</span> pushes
                  it live.
                </p>
              </div>
            )}
          </div>

          {/* AI assistant */}
          <div className="border-t border-border p-4">
            {doc?.type === "page" ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  runAiEdit();
                }}
                className="rounded-lg border border-border bg-background p-3"
              >
                <textarea
                  value={aiInstruction}
                  onChange={(e) => setAiInstruction(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      runAiEdit();
                    }
                  }}
                  rows={2}
                  placeholder="Ask AI to change anything… e.g. “make the headline punchier”"
                  className="w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted/50 focus:outline-none"
                />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-muted/70">
                    Edits the text on this page. Review, then Save.
                  </span>
                  <Button
                    type="submit"
                    className="h-7 px-3 text-xs"
                    loading={aiBusy}
                    disabled={!aiInstruction.trim()}
                  >
                    Send
                  </Button>
                </div>
              </form>
            ) : (
              <p className="text-xs text-muted/70">
                AI editing is available on pages. Open a page to use it.
              </p>
            )}
          </div>
        </aside>
      </div>

      {/* SEO overlay */}
      {seoOpen && doc?.type === "page" && pageForm && currentPage && (
        <SeoPanel
          form={pageForm}
          pageSlug={currentPage.slug}
          domain={bundle.website.domain}
          update={(patch) => setPageForm((f) => (f ? { ...f, ...patch } : f))}
          onSave={saveDraft}
          saving={saving}
          onClose={() => setSeoOpen(false)}
        />
      )}

      {tutorial.open && <Tutorial onClose={tutorial.dismiss} />}
    </div>
  );
}
