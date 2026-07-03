import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError, handleApiError, isUniqueViolation } from "@/lib/http";
import { parseJson, websiteUpdateSchema } from "@/lib/validation";
import { hashPassword } from "@/lib/clientAuth";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("websites")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return apiError(404, "not_found");
    return NextResponse.json({ website: data });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const parsed = await parseJson(req, websiteUpdateSchema);
    if (parsed.error) {
      return apiError(400, parsed.error.message, parsed.error.issues);
    }

    // client_password is write-only: hash it into client_password_hash.
    const { client_password, ...fields } = parsed.data;
    const update: Record<string, unknown> = {
      ...fields,
      updated_at: new Date().toISOString(),
    };
    if (client_password !== undefined) {
      update.client_password_hash =
        client_password === null ? null : hashPassword(client_password);
    }

    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("websites")
      .update(update)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) {
      if (isUniqueViolation(error)) {
        return apiError(409, "That slug is already in use");
      }
      throw error;
    }
    if (!data) return apiError(404, "not_found");
    return NextResponse.json({ website: data });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const supabase = supabaseAdmin();
    const { error } = await supabase.from("websites").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
