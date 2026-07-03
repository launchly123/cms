"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Banner } from "@/app/components/ui";
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

export default function NewBlogPostPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<React.ReactNode>(null);

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
      const res = await fetch(`/api/websites/${id}/blog`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(friendlyError(body));
        return;
      }
      router.push(`/sites/${id}/blog`);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      <h2 className="mb-6 text-base font-semibold">New post</h2>
      {error && (
        <Banner kind="error" onDismiss={() => setError(null)}>
          {error}
        </Banner>
      )}
      <BlogPostForm websiteId={id} initial={null} onSave={handleSave} saving={saving} />
    </div>
  );
}
