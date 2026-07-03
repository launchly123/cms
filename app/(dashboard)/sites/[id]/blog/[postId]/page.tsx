"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { BlogPost } from "@/lib/types";
import { Banner, Spinner, useFlash } from "@/app/components/ui";
import { BlogPostForm } from "@/app/components/BlogPostForm";

function friendlyError(data: { error?: string; details?: unknown }): React.ReactNode {
  if (data.error === "supabase_not_configured") {
    return "Supabase isn't connected yet — add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local and run supabase/schema.sql (see the Websites page for full steps).";
  }
  if (Array.isArray(data.details) && data.details.every((d) => typeof d === "string")) {
    return (
      <div>
        <p>{data.error || "Please fix the following:"}</p>
        <ul className="mt-1 list-disc pl-5">
          {(data.details as string[]).map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      </div>
    );
  }
  if (data.error && typeof data.error === "string" && data.error !== "internal_error") {
    return data.error;
  }
  return "Something went wrong. Please try again.";
}

export default function EditBlogPostPage() {
  const { id, postId } = useParams<{ id: string; postId: string }>();
  const [post, setPost] = React.useState<BlogPost | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [notFound, setNotFound] = React.useState(false);
  const [error, setError] = React.useState<React.ReactNode>(null);
  const [saving, setSaving] = React.useState(false);
  const [flash, setFlash] = useFlash();

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      setNotFound(false);
      try {
        const res = await fetch(`/api/websites/${id}/blog/${postId}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.status === 404) {
          setNotFound(true);
        } else if (!res.ok) {
          setError(friendlyError(data));
        } else {
          setPost(data.post);
        }
      } catch {
        if (!cancelled) setError("Something went wrong. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id, postId]);

  async function handleSave(data: {
    title: string;
    slug?: string;
    excerpt: string | null;
    content: string;
    featured_image_url: string | null;
    published: boolean;
  }) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/websites/${id}/blog/${postId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(friendlyError(body));
        return;
      }
      setPost(body.post);
      setFlash("Saved");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center p-8 py-24">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="p-8 max-w-3xl">
        <Banner kind="error">Post not found</Banner>
        <Link
          href={`/sites/${id}/blog`}
          className="text-sm text-muted underline hover:text-foreground"
        >
          Back to blog posts
        </Link>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl">
      <h2 className="mb-6 text-base font-semibold">Edit post</h2>
      {flash && <Banner kind="success">{flash}</Banner>}
      {error && (
        <Banner kind="error" onDismiss={() => setError(null)}>
          {error}
        </Banner>
      )}
      {post && (
        <BlogPostForm
          websiteId={id}
          initial={post}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </div>
  );
}
