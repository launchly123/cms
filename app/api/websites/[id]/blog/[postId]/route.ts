import { NextResponse } from "next/server";
import type { BlogPost } from "@/lib/types";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError, handleApiError, isUniqueViolation } from "@/lib/http";
import { blogUpdateSchema, parseJson } from "@/lib/validation";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string; postId: string }> }
) {
  try {
    const { id, postId } = await ctx.params;
    const { data, error } = await supabaseAdmin()
      .from("blog_posts")
      .select("*")
      .eq("website_id", id)
      .eq("id", postId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return apiError(404, "not_found");
    return NextResponse.json({ post: data });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string; postId: string }> }
) {
  try {
    const { id, postId } = await ctx.params;
    const parsed = await parseJson(req, blogUpdateSchema);
    if (parsed.error) {
      return apiError(400, parsed.error.message, parsed.error.issues);
    }

    const { data: existing, error: loadError } = await supabaseAdmin()
      .from("blog_posts")
      .select("*")
      .eq("website_id", id)
      .eq("id", postId)
      .maybeSingle();
    if (loadError) throw loadError;
    if (!existing) return apiError(404, "not_found");
    const current = existing as BlogPost;

    const body = parsed.data;
    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (body.title !== undefined) update.title = body.title;
    if (body.slug !== undefined) update.slug = body.slug;
    if (body.excerpt !== undefined) update.excerpt = body.excerpt;
    if (body.content !== undefined) update.content = body.content;
    if (body.featured_image_url !== undefined)
      update.featured_image_url = body.featured_image_url;
    if (body.published !== undefined) {
      update.published = body.published;
      if (body.published && current.published_at === null) {
        update.published_at = new Date().toISOString();
      }
    }

    const { data, error } = await supabaseAdmin()
      .from("blog_posts")
      .update(update)
      .eq("website_id", id)
      .eq("id", postId)
      .select("*")
      .maybeSingle();
    if (error) {
      if (isUniqueViolation(error)) {
        return apiError(409, "That slug is already in use");
      }
      throw error;
    }
    if (!data) return apiError(404, "not_found");
    return NextResponse.json({ post: data });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; postId: string }> }
) {
  try {
    const { id, postId } = await ctx.params;
    const { error } = await supabaseAdmin()
      .from("blog_posts")
      .delete()
      .eq("website_id", id)
      .eq("id", postId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
