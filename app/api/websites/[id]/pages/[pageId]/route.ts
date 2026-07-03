import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError, handleApiError, isUniqueViolation } from "@/lib/http";
import { pageUpdateSchema, parseJson } from "@/lib/validation";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string; pageId: string }> }
) {
  try {
    const { id, pageId } = await ctx.params;
    const { data, error } = await supabaseAdmin()
      .from("pages")
      .select("*")
      .eq("website_id", id)
      .eq("id", pageId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return apiError(404, "not_found");
    return NextResponse.json({ page: data });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string; pageId: string }> }
) {
  try {
    const { id, pageId } = await ctx.params;
    const parsed = await parseJson(req, pageUpdateSchema);
    if (parsed.error) {
      return apiError(400, parsed.error.message, parsed.error.issues);
    }

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    const body = parsed.data;
    if (body.title !== undefined) update.title = body.title;
    if (body.slug !== undefined) update.slug = body.slug;
    if (body.hero_heading !== undefined) update.hero_heading = body.hero_heading;
    if (body.hero_subheading !== undefined)
      update.hero_subheading = body.hero_subheading;
    if (body.hero_image_url !== undefined)
      update.hero_image_url = body.hero_image_url;
    if (body.content !== undefined) update.content = body.content;
    if (body.seo_title !== undefined) update.seo_title = body.seo_title;
    if (body.seo_description !== undefined)
      update.seo_description = body.seo_description;

    const { data, error } = await supabaseAdmin()
      .from("pages")
      .update(update)
      .eq("website_id", id)
      .eq("id", pageId)
      .select("*")
      .maybeSingle();
    if (error) {
      if (isUniqueViolation(error)) {
        return apiError(409, "That slug is already in use");
      }
      throw error;
    }
    if (!data) return apiError(404, "not_found");
    return NextResponse.json({ page: data });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; pageId: string }> }
) {
  try {
    const { id, pageId } = await ctx.params;
    const { error } = await supabaseAdmin()
      .from("pages")
      .delete()
      .eq("website_id", id)
      .eq("id", pageId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
