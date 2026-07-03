"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { BlogPost } from "@/lib/types";
import {
  Badge,
  Banner,
  Button,
  EmptyState,
  Spinner,
  useFlash,
} from "@/app/components/ui";

function friendlyError(data: { error?: string; details?: unknown }): string {
  if (data.error === "supabase_not_configured") {
    return "Supabase isn't connected yet — add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local and run supabase/schema.sql (see the Websites page for full steps).";
  }
  if (data.error === "vercel_not_configured") {
    return "Add your VERCEL_API_TOKEN to .env.local to sync from Vercel.";
  }
  if (Array.isArray(data.details) && data.details.every((d) => typeof d === "string")) {
    return (data.details as string[]).join(" ");
  }
  return "Something went wrong. Please try again.";
}

export default function BlogListPage() {
  const { id } = useParams<{ id: string }>();
  const [posts, setPosts] = React.useState<BlogPost[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [flash, setFlash] = useFlash();

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/websites/${id}/blog`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(friendlyError(data));
        } else {
          setPosts(data.posts ?? []);
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
  }, [id]);

  async function togglePublished(post: BlogPost) {
    setBusyId(post.id);
    setError(null);
    try {
      const res = await fetch(`/api/websites/${id}/blog/${post.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !post.published }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(friendlyError(data));
        return;
      }
      const updated: BlogPost = data.post;
      setPosts((prev) => prev.map((p) => (p.id === post.id ? updated : p)));
      setFlash(updated.published ? "Published" : "Moved to drafts");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function deletePost(post: BlogPost) {
    if (!window.confirm(`Delete "${post.title}"? This cannot be undone.`)) return;
    setBusyId(post.id);
    setError(null);
    try {
      const res = await fetch(`/api/websites/${id}/blog/${post.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(friendlyError(data));
        return;
      }
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      setFlash("Post deleted");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold">Blog posts</h2>
        <Link
          href={`/sites/${id}/blog/new`}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-medium text-background transition-colors hover:opacity-85"
        >
          New post
        </Link>
      </div>

      {flash && <Banner kind="success">{flash}</Banner>}
      {error && (
        <Banner kind="error" onDismiss={() => setError(null)}>
          {error}
        </Banner>
      )}

      {loading ? (
        <div className="flex justify-center py-24">
          <Spinner className="h-6 w-6" />
        </div>
      ) : posts.length === 0 ? (
        <EmptyState
          title="No posts yet"
          description="Write your first blog post."
          action={
            <Link
              href={`/sites/${id}/blog/new`}
              className="inline-flex h-9 items-center justify-center rounded-md bg-foreground px-4 text-sm font-medium text-background transition-colors hover:opacity-85"
            >
              New post
            </Link>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
                <th className="py-3 px-4 font-medium">Post</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium">Date</th>
                <th className="py-3 px-4 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr
                  key={post.id}
                  className="border-b border-border/60 transition-colors hover:bg-card-hover"
                >
                  <td className="py-3 px-4">
                    <span className="block font-bold">{post.title}</span>
                    <span className="block text-xs text-muted">/{post.slug}</span>
                  </td>
                  <td className="py-3 px-4">
                    {post.published ? (
                      <Badge color="green">Published</Badge>
                    ) : (
                      <Badge color="gray">Draft</Badge>
                    )}
                  </td>
                  <td className="py-3 px-4 text-muted">
                    {new Date(post.published_at ?? post.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/sites/${id}/blog/${post.id}`}
                        className="inline-flex h-8 items-center justify-center rounded-md border border-border px-3 text-xs font-medium text-foreground transition-colors hover:bg-card-hover"
                      >
                        Edit
                      </Link>
                      <Button
                        variant="ghost"
                        className="h-8 px-3 text-xs"
                        loading={busyId === post.id}
                        onClick={() => togglePublished(post)}
                      >
                        {post.published ? "Unpublish" : "Publish"}
                      </Button>
                      <button
                        type="button"
                        className="h-8 rounded-md px-2 text-xs font-medium text-red-400 transition-colors hover:bg-red-600/15 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={busyId === post.id}
                        onClick={() => deletePost(post)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
