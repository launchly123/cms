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
      .is("deleted_at", null)
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
      .is("deleted_at", null)
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

/**
 * Delete a site.
 *
 * This marks the row deleted rather than removing it, and that is deliberate.
 * The dashboard POSTs /api/websites/sync on every load, which imports any
 * Vercel project whose id is not already on a websites row. Removing the row
 * therefore un-deletes the site on the next page load — the bug this replaces.
 * The tombstone keeps the id known, so the sync skips it forever.
 *
 * `?purge=1` really does remove the row, for when the Vercel project is gone
 * too and there is nothing left to re-import. Deleting the row while the
 * project still exists in Vercel will simply bring the site back.
 */
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const purge = new URL(req.url).searchParams.get("purge") === "1";
    const supabase = supabaseAdmin();

    if (purge) {
      const { error } = await supabase.from("websites").delete().eq("id", id);
      if (error) throw error;
      return NextResponse.json({ ok: true, purged: true });
    }

    const { data, error } = await supabase
      .from("websites")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) return apiError(404, "not_found");
    return NextResponse.json({ ok: true, purged: false });
  } catch (e) {
    return handleApiError(e);
  }
}

/** Undo a delete. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("websites")
      .update({ deleted_at: null })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) return apiError(404, "not_found");
    return NextResponse.json({ website: data });
  } catch (e) {
    return handleApiError(e);
  }
}
