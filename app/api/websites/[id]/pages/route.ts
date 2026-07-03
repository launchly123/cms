import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError, handleApiError, isUniqueViolation } from "@/lib/http";
import { pageCreateSchema, parseJson, slugify } from "@/lib/validation";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const { data, error } = await supabaseAdmin()
      .from("pages")
      .select("*")
      .eq("website_id", id)
      .order("slug", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ pages: data ?? [] });
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
    const parsed = await parseJson(req, pageCreateSchema);
    if (parsed.error) {
      return apiError(400, parsed.error.message, parsed.error.issues);
    }
    const { title } = parsed.data;
    const slug = parsed.data.slug ?? slugify(title);

    const { data, error } = await supabaseAdmin()
      .from("pages")
      .insert({ website_id: id, slug, title, content: [] })
      .select("*")
      .single();
    if (error) {
      if (isUniqueViolation(error)) {
        return apiError(409, "That slug is already in use");
      }
      throw error;
    }
    return NextResponse.json({ page: data });
  } catch (e) {
    return handleApiError(e);
  }
}
