import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseConfigured } from "@/lib/supabase";

/**
 * PUBLIC (no auth) endpoint read by connected client sites. Returns the
 * PUBLISHED text/image overrides for a website's page so the live site can
 * apply the edits made in the CMS. CORS-open so any client domain can read it.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "public, max-age=30",
};

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS });
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  try {
    if (!supabaseConfigured()) {
      return NextResponse.json({ overrides: {} }, { headers: CORS });
    }
    const { slug } = await ctx.params;
    const pageSlug = new URL(req.url).searchParams.get("page") || "home";

    const { data: website } = await supabaseAdmin()
      .from("websites")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!website) {
      return NextResponse.json({ overrides: {} }, { headers: CORS });
    }

    const { data: page } = await supabaseAdmin()
      .from("pages")
      .select("content_overrides, updated_at")
      .eq("website_id", website.id)
      .eq("slug", pageSlug)
      .maybeSingle();

    return NextResponse.json(
      {
        overrides: (page?.content_overrides as Record<string, string>) ?? {},
        updated_at: page?.updated_at ?? null,
      },
      { headers: CORS }
    );
  } catch {
    // Never break the client site — return empty on any error.
    return NextResponse.json({ overrides: {} }, { headers: CORS });
  }
}
