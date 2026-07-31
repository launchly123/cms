import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { handleApiError } from "@/lib/http";

/**
 * Leads = rows in the `businesses` table, written by the Offline Business
 * Finder. That app owns ingestion; this console reads them and lets an
 * operator work the outreach fields.
 *
 * The table has row-level security enabled with no policies, so it is only
 * reachable with the service role key — never from the browser directly.
 */

const PAGE_SIZE = 60;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const category = url.searchParams.get("category");
    const status = url.searchParams.get("status");
    const search = url.searchParams.get("q")?.trim();
    const includeOnline = url.searchParams.get("includeOnline") === "1";
    const page = Math.max(0, Number(url.searchParams.get("page") ?? 0) || 0);

    const supabase = supabaseAdmin();
    let query = supabase
      .from("businesses")
      .select("*", { count: "exact" })
      .order("updated_at", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    // The whole point of the list is businesses without a site of their own.
    if (!includeOnline) query = query.neq("website_signal", "has_website");
    if (category) query = query.eq("category", category);
    if (status) query = query.eq("lead_status", status);
    if (search) {
      const like = `%${search}%`;
      query = query.or(
        `name.ilike.${like},city.ilike.${like},state.ilike.${like},postal_code.ilike.${like}`
      );
    }

    const { data, error, count } = await query;
    if (error) {
      // The finder may not have run its migration yet.
      if (error.code === "42P01") {
        return NextResponse.json({ leads: [], total: 0, pageSize: PAGE_SIZE, missing: true });
      }
      throw error;
    }

    return NextResponse.json({
      leads: data ?? [],
      total: count ?? 0,
      pageSize: PAGE_SIZE,
      missing: false,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
