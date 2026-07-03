"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Banner,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Spinner,
} from "@/app/components/ui";
import type { Page } from "@/lib/types";

function friendlyError(data: { error?: string; details?: unknown }): React.ReactNode {
  if (data.error === "supabase_not_configured") {
    return "Supabase isn't connected yet — add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local and run supabase/schema.sql (see the Websites page for full steps).";
  }
  if (data.error === "vercel_not_configured") {
    return "Add your VERCEL_API_TOKEN to .env.local to sync from Vercel.";
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
  if (typeof data.error === "string" && data.error !== "internal_error" && data.error !== "not_found") {
    return data.error;
  }
  return "Something went wrong. Please try again.";
}

export default function PagesListPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [pages, setPages] = React.useState<Page[] | null>(null);
  const [loadError, setLoadError] = React.useState<React.ReactNode | null>(null);

  const [showForm, setShowForm] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [createError, setCreateError] = React.useState<React.ReactNode | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/websites/${id}/pages`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setLoadError(friendlyError(data));
          return;
        }
        setPages(data.pages ?? []);
      } catch {
        if (!cancelled) setLoadError("Something went wrong. Please try again.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setCreateError("Please enter a title for the page.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const body: { title: string; slug?: string } = { title: title.trim() };
      if (slug.trim()) body.slug = slug.trim();
      const res = await fetch(`/api/websites/${id}/pages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCreateError(friendlyError(data));
        setCreating(false);
        return;
      }
      router.push(`/sites/${id}/pages/${data.page.id}`);
    } catch {
      setCreateError("Something went wrong. Please try again.");
      setCreating(false);
    }
  };

  if (loadError) {
    return (
      <div className="p-8 max-w-5xl">
        <Banner kind="error">{loadError}</Banner>
      </div>
    );
  }

  if (pages === null) {
    return (
      <div className="flex justify-center p-16">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold">Pages</h2>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "New page"}
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6 p-5">
          <form onSubmit={handleCreate} className="space-y-4">
            {createError && (
              <Banner kind="error" onDismiss={() => setCreateError(null)}>
                {createError}
              </Banner>
            )}
            <Field label="Title">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="About us"
                autoFocus
              />
            </Field>
            <Field
              label="Slug (optional)"
              hint="Lowercase letters, numbers, dashes. Leave blank to generate from the title."
            >
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="about"
              />
            </Field>
            <div className="flex justify-end">
              <Button type="submit" loading={creating}>
                Create page
              </Button>
            </div>
          </form>
        </Card>
      )}

      {pages.length === 0 ? (
        <EmptyState
          title="No pages yet"
          description="Create your first page — for example Home, About, or Services."
          action={
            !showForm ? (
              <Button onClick={() => setShowForm(true)}>New page</Button>
            ) : undefined
          }
        />
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted border-b border-border">
                <th className="py-3 px-4 font-medium">Page</th>
                <th className="py-3 px-4 font-medium">Last updated</th>
                <th className="py-3 px-4" />
              </tr>
            </thead>
            <tbody>
              {pages.map((page) => (
                <tr
                  key={page.id}
                  className="border-b border-border/60 last:border-b-0 hover:bg-card-hover transition-colors"
                >
                  <td className="py-3 px-4">
                    <div className="font-bold">{page.title}</div>
                    <div className="font-mono text-xs text-muted">/{page.slug}</div>
                  </td>
                  <td className="py-3 px-4 text-muted">
                    {new Date(page.updated_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Link
                      href={`/sites/${id}/pages/${page.id}`}
                      className="text-sm text-foreground hover:underline"
                    >
                      Edit →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
