"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Banner,
  Button,
  Card,
  Field,
  Input,
  Spinner,
  Textarea,
  useFlash,
} from "@/app/components/ui";
import { ImageDropzone } from "@/app/components/ImageDropzone";
import type { ContentSection, Page } from "@/lib/types";

interface PageForm {
  title: string;
  slug: string;
  hero_heading: string;
  hero_subheading: string;
  hero_image_url: string | null;
  content: ContentSection[];
  seo_title: string;
  seo_description: string;
}

function toForm(page: Page): PageForm {
  return {
    title: page.title ?? "",
    slug: page.slug ?? "",
    hero_heading: page.hero_heading ?? "",
    hero_subheading: page.hero_subheading ?? "",
    hero_image_url: page.hero_image_url ?? null,
    content: Array.isArray(page.content)
      ? page.content.map((s) => ({
          id: s.id,
          heading: s.heading ?? "",
          body: s.body ?? "",
          image_url: s.image_url ?? null,
        }))
      : [],
    seo_title: page.seo_title ?? "",
    seo_description: page.seo_description ?? "",
  };
}

function friendlyError(data: { error?: string; details?: unknown }): React.ReactNode {
  if (data.error === "supabase_not_configured") {
    return "Supabase isn't connected yet — add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local and run supabase/schema.sql (see the Websites page for full steps).";
  }
  if (data.error === "vercel_not_configured") {
    return "Add your VERCEL_API_TOKEN to .env.local to sync from Vercel.";
  }
  if (data.error === "not_found") {
    return "This page could not be found. It may have been deleted.";
  }
  if (Array.isArray(data.details) && data.details.every((d) => typeof d === "string") && data.details.length > 0) {
    return (
      <ul className="list-disc pl-4">
        {(data.details as string[]).map((issue, i) => (
          <li key={i}>{issue}</li>
        ))}
      </ul>
    );
  }
  if (typeof data.error === "string" && data.error !== "internal_error") {
    return data.error;
  }
  return "Something went wrong. Please try again.";
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">
      {children}
    </h3>
  );
}

export default function PageEditorPage() {
  const { id, pageId } = useParams<{ id: string; pageId: string }>();
  const router = useRouter();

  const [form, setForm] = React.useState<PageForm | null>(null);
  const [snapshot, setSnapshot] = React.useState<string>("");
  const [loadError, setLoadError] = React.useState<React.ReactNode | null>(null);
  const [saveError, setSaveError] = React.useState<React.ReactNode | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [flash, setFlash] = useFlash();

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/websites/${id}/pages/${pageId}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setLoadError(friendlyError(data));
          return;
        }
        const next = toForm(data.page as Page);
        setForm(next);
        setSnapshot(JSON.stringify(next));
      } catch {
        if (!cancelled) setLoadError("Something went wrong. Please try again.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, pageId]);

  const update = (patch: Partial<PageForm>) =>
    setForm((prev) => (prev ? { ...prev, ...patch } : prev));

  const updateSection = (sectionId: string, patch: Partial<ContentSection>) =>
    setForm((prev) =>
      prev
        ? {
            ...prev,
            content: prev.content.map((s) =>
              s.id === sectionId ? { ...s, ...patch } : s
            ),
          }
        : prev
    );

  const addSection = () =>
    setForm((prev) =>
      prev
        ? {
            ...prev,
            content: [
              ...prev.content,
              { id: crypto.randomUUID(), heading: "", body: "", image_url: null },
            ],
          }
        : prev
    );

  const removeSection = (sectionId: string) => {
    if (!window.confirm("Remove this section? This can't be undone after saving.")) return;
    setForm((prev) =>
      prev
        ? { ...prev, content: prev.content.filter((s) => s.id !== sectionId) }
        : prev
    );
  };

  const dirty = form !== null && JSON.stringify(form) !== snapshot;

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    setSaveError(null);
    try {
      const body = {
        title: form.title,
        slug: form.slug,
        hero_heading: form.hero_heading.trim() === "" ? null : form.hero_heading,
        hero_subheading: form.hero_subheading.trim() === "" ? null : form.hero_subheading,
        hero_image_url: form.hero_image_url,
        content: form.content.map((s) => ({
          id: s.id,
          heading: s.heading,
          body: s.body,
          image_url: s.image_url ?? null,
        })),
        seo_title: form.seo_title.trim() === "" ? null : form.seo_title,
        seo_description: form.seo_description.trim() === "" ? null : form.seo_description,
      };
      const res = await fetch(`/api/websites/${id}/pages/${pageId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(friendlyError(data));
        return;
      }
      const next = toForm(data.page as Page);
      setForm(next);
      setSnapshot(JSON.stringify(next));
      setFlash("Saved");
    } catch {
      setSaveError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this page? This can't be undone.")) return;
    setDeleting(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/websites/${id}/pages/${pageId}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(friendlyError(data));
        setDeleting(false);
        return;
      }
      router.push(`/sites/${id}/pages`);
    } catch {
      setSaveError("Something went wrong. Please try again.");
      setDeleting(false);
    }
  };

  if (loadError) {
    return (
      <div className="p-8 max-w-3xl">
        <Banner kind="error">{loadError}</Banner>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="flex justify-center p-16">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl">
      {flash && <Banner kind="success">{flash}</Banner>}
      {saveError && (
        <Banner kind="error" onDismiss={() => setSaveError(null)}>
          {saveError}
        </Banner>
      )}

      <div className="space-y-6">
        <Card className="p-5 space-y-4">
          <SectionTitle>Basics</SectionTitle>
          <Field label="Title">
            <Input
              value={form.title}
              onChange={(e) => update({ title: e.target.value })}
            />
          </Field>
          <Field label="Slug" hint="Lowercase letters, numbers, dashes.">
            <Input
              value={form.slug}
              onChange={(e) => update({ slug: e.target.value })}
            />
          </Field>
        </Card>

        <Card className="p-5 space-y-4">
          <SectionTitle>Hero</SectionTitle>
          <Field label="Heading">
            <Input
              value={form.hero_heading}
              onChange={(e) => update({ hero_heading: e.target.value })}
            />
          </Field>
          <Field label="Subheading">
            <Textarea
              rows={2}
              value={form.hero_subheading}
              onChange={(e) => update({ hero_subheading: e.target.value })}
            />
          </Field>
          <ImageDropzone
            label="Hero image"
            websiteId={id}
            value={form.hero_image_url}
            onChange={(url) => update({ hero_image_url: url })}
          />
        </Card>

        <Card className="p-5 space-y-4">
          <SectionTitle>Content sections</SectionTitle>
          {form.content.length === 0 && (
            <p className="text-sm text-muted">
              No sections yet. Add one to build out this page.
            </p>
          )}
          {form.content.map((section, index) => (
            <div
              key={section.id}
              className="rounded-lg border border-border p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted">
                  Section {index + 1}
                </span>
                <Button
                  type="button"
                  variant="danger"
                  className="h-7 px-2.5 text-xs"
                  onClick={() => removeSection(section.id)}
                >
                  Remove section
                </Button>
              </div>
              <Field label="Heading">
                <Input
                  value={section.heading}
                  onChange={(e) =>
                    updateSection(section.id, { heading: e.target.value })
                  }
                />
              </Field>
              <Field label="Body">
                <Textarea
                  rows={5}
                  value={section.body}
                  onChange={(e) =>
                    updateSection(section.id, { body: e.target.value })
                  }
                />
              </Field>
              <ImageDropzone
                label="Section image (optional)"
                websiteId={id}
                value={section.image_url ?? null}
                onChange={(url) => updateSection(section.id, { image_url: url })}
              />
            </div>
          ))}
          <Button type="button" variant="ghost" onClick={addSection}>
            Add section
          </Button>
        </Card>

        <Card className="p-5 space-y-4">
          <SectionTitle>SEO</SectionTitle>
          <Field
            label="SEO title"
            hint="Shown in the browser tab and Google results"
          >
            <Input
              value={form.seo_title}
              onChange={(e) => update({ seo_title: e.target.value })}
            />
          </Field>
          <Field
            label="SEO description"
            hint="1–2 sentences shown under the title in Google"
          >
            <Textarea
              rows={3}
              value={form.seo_description}
              onChange={(e) => update({ seo_description: e.target.value })}
            />
          </Field>
        </Card>
      </div>

      <div className="sticky bottom-0 mt-6 -mx-8 flex items-center justify-between border-t border-border bg-background/90 px-8 py-3 backdrop-blur">
        <Button
          type="button"
          variant="danger"
          loading={deleting}
          onClick={handleDelete}
        >
          Delete page
        </Button>
        <Button
          type="button"
          loading={saving}
          disabled={!dirty}
          onClick={handleSave}
        >
          Save changes
        </Button>
      </div>
    </div>
  );
}
