import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError, handleApiError } from "@/lib/http";
import { getEditorAccess } from "@/lib/clientAccess";
import { revalidateSite } from "@/lib/vercel";
import type { BlogPost } from "@/lib/types";

/**
 * Publish a blog post: apply its draft (if any), mark it published,
 * and refresh the live site's blog pages.
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ slug: string; postId: string }> }
) {
  try {
    const { slug, postId } = await ctx.params;
    const result = await getEditorAccess(slug);
    if (!result.ok) {
      return apiError(result.reason === "not_found" ? 404 : 401, result.reason);
    }
    const { website } = result.access;

    const { data: existing, error: loadError } = await supabaseAdmin()
      .from("blog_posts")
      .select("*")
      .eq("website_id", website.id)
      .eq("id", postId)
      .maybeSingle();
    if (loadError) throw loadError;
    if (!existing) return apiError(404, "not_found");
    const post = existing as BlogPost;

    const d = post.draft;
    const update: Record<string, unknown> = {
      published: true,
      draft: null,
      updated_at: new Date().toISOString(),
    };
    if (d) {
      update.title = d.title;
      update.excerpt = d.excerpt;
      update.content = d.content;
      update.featured_image_url = d.featured_image_url;
    }
    if (post.published_at === null) {
      update.published_at = new Date().toISOString();
    }

    const { data, error } = await supabaseAdmin()
      .from("blog_posts")
      .update(update)
      .eq("website_id", website.id)
      .eq("id", postId)
      .select("*")
      .single();
    if (error) throw error;

    let revalidated = false;
    if (website.domain) {
      revalidated = await revalidateSite(website.domain, `/blog/${post.slug}`);
      await revalidateSite(website.domain, "/blog");
    }

    return NextResponse.json({ post: data, revalidated });
  } catch (e) {
    return handleApiError(e);
  }
}
