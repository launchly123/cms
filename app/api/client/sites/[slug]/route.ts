import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError, handleApiError } from "@/lib/http";
import { getEditorAccess, publicWebsite } from "@/lib/clientAccess";

/** Editor bundle: the website, its pages (with drafts) and blog posts. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await ctx.params;
    const result = await getEditorAccess(slug);
    if (!result.ok) {
      return apiError(result.reason === "not_found" ? 404 : 401, result.reason);
    }
    const { website, role } = result.access;

    const [pagesRes, postsRes] = await Promise.all([
      supabaseAdmin()
        .from("pages")
        .select("*")
        .eq("website_id", website.id)
        .order("slug"),
      supabaseAdmin()
        .from("blog_posts")
        .select("*")
        .eq("website_id", website.id)
        .order("created_at", { ascending: false }),
    ]);
    if (pagesRes.error) throw pagesRes.error;
    if (postsRes.error) throw postsRes.error;

    return NextResponse.json({
      website: publicWebsite(website),
      role,
      pages: pagesRes.data ?? [],
      posts: postsRes.data ?? [],
    });
  } catch (e) {
    return handleApiError(e);
  }
}
