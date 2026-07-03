import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError, handleApiError } from "@/lib/http";
import { contactSchema, parseJson } from "@/lib/validation";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const { data, error } = await supabaseAdmin()
      .from("contacts")
      .select("*")
      .eq("website_id", id)
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json({ contact: data ?? null });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const parsed = await parseJson(req, contactSchema);
    if (parsed.error) {
      return apiError(400, parsed.error.message, parsed.error.issues);
    }
    const body = parsed.data;

    const { data, error } = await supabaseAdmin()
      .from("contacts")
      .upsert(
        {
          website_id: id,
          email: body.email || null,
          phone: body.phone || null,
          address: body.address || null,
          social_links: body.social_links ?? {},
          updated_at: new Date().toISOString(),
        },
        { onConflict: "website_id" }
      )
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({ contact: data });
  } catch (e) {
    return handleApiError(e);
  }
}
