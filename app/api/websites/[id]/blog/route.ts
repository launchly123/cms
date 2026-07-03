import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError, handleApiError, isUniqueViolation } from "@/lib/http";
import { blogCreateSchema, parseJson, slugify } from "@/lib/validation";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const { data, error } = await supabaseAdmin()
      .from("blog_posts")
      .select("*")
      .eq("website_id", id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ posts: data ?? [] });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const parsed = await parseJson(req, blogCreateSchema);
    if (parsed.error) {
      return apiError(400, parsed.error.message, parsed.error.issues);
    }
    const body = parsed.data;
    const slug = body.slug ?? slugify(body.title);
    const published = body.published ?? false;

    const { data, error } = await supabaseAdmin()
      .from("blog_posts")
      .insert({
        website_id: id,
        slug,
        title: body.title,
        excerpt: body.excerpt ?? null,
        content: body.content ?? "",
        featured_image_url: body.featured_image_url ?? null,
        published,
        published_at: published ? new Date().toISOString() : null,
      })
      .select("*")
      .single();
    if (error) {
      if (isUniqueViolation(error)) {
        return apiError(409, "That slug is already in use");
      }
      throw error;
    }
    return NextResponse.json({ post: data });
  } catch (e) {
    return handleApiError(e);
  }
}
