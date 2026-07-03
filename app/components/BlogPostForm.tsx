"use client";

import * as React from "react";
import type { BlogPost } from "@/lib/types";
import { Button, Card, Field, Input, Textarea } from "@/app/components/ui";
import { RichTextEditor } from "@/app/components/RichTextEditor";
import { ImageDropzone } from "@/app/components/ImageDropzone";

export function BlogPostForm({
  websiteId,
  initial,
  onSave,
  saving,
}: {
  websiteId: string;
  initial: Partial<BlogPost> | null;
  onSave: (data: {
    title: string;
    slug?: string;
    excerpt: string | null;
    content: string;
    featured_image_url: string | null;
    published: boolean;
  }) => Promise<void>;
  saving: boolean;
}) {
  const [title, setTitle] = React.useState(initial?.title ?? "");
  const [slug, setSlug] = React.useState(initial?.slug ?? "");
  const [excerpt, setExcerpt] = React.useState(initial?.excerpt ?? "");
  const [content, setContent] = React.useState(initial?.content ?? "");
  const [featuredImageUrl, setFeaturedImageUrl] = React.useState<string | null>(
    initial?.featured_image_url ?? null
  );
  const [published, setPublished] = React.useState(initial?.published ?? false);
  const [titleError, setTitleError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setTitleError("A title is required.");
      return;
    }
    setTitleError(null);
    const trimmedSlug = slug.trim();
    await onSave({
      title: title.trim(),
      ...(trimmedSlug ? { slug: trimmedSlug } : {}),
      excerpt: excerpt.trim() ? excerpt.trim() : null,
      content,
      featured_image_url: featuredImageUrl,
      published,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="p-5">
        <h3 className="mb-4 text-sm font-semibold">Post</h3>
        <div className="space-y-4">
          <Field label="Title" error={titleError}>
            <Input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (titleError && e.target.value.trim()) setTitleError(null);
              }}
              placeholder="My great post"
            />
          </Field>
          <Field label="Slug" hint="Leave blank to generate from the title">
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="my-great-post"
            />
          </Field>
          <Field label="Excerpt" hint="Short summary shown in blog lists">
            <Textarea
              rows={2}
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="A short teaser for this post…"
            />
          </Field>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="mb-4 text-sm font-semibold">Content</h3>
        <RichTextEditor value={content} onChange={setContent} />
      </Card>

      <Card className="p-5">
        <h3 className="mb-4 text-sm font-semibold">Featured image</h3>
        <ImageDropzone
          websiteId={websiteId}
          value={featuredImageUrl}
          onChange={setFeaturedImageUrl}
          label="Featured image"
        />
      </Card>

      <Card className="p-5">
        <h3 className="mb-4 text-sm font-semibold">Publishing</h3>
        <label className="flex cursor-pointer items-center justify-between gap-4">
          <span>
            <span className="block text-sm font-medium text-foreground">
              Published
            </span>
            <span className="block text-xs text-muted">
              Draft posts are only visible here in the CMS.
            </span>
          </span>
          <span
            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
              published ? "bg-emerald-600" : "bg-border"
            }`}
          >
            <input
              type="checkbox"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
              aria-label="Published"
            />
            <span
              className={`pointer-events-none absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-foreground transition-transform ${
                published ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </span>
        </label>
      </Card>

      <div className="sticky bottom-0 -mx-8 flex justify-end border-t border-border bg-background/90 px-8 py-3 backdrop-blur">
        <Button type="submit" loading={saving}>
          Save post
        </Button>
      </div>
    </form>
  );
}
