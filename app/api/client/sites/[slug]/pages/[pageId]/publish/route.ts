import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError, handleApiError } from "@/lib/http";
import { getEditorAccess } from "@/lib/clientAccess";
import { revalidateSite } from "@/lib/vercel";
import type { Page } from "@/lib/types";

/** Publish a page: copy its draft into the live fields and refresh the site. */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ slug: string; pageId: string }> }
) {
  try {
    const { slug, pageId } = await ctx.params;
    const result = await getEditorAccess(slug);
    if (!result.ok) {
      return apiError(result.reason === "not_found" ? 404 : 401, result.reason);
    }
    const { website } = result.access;

    const { data: existing, error: loadError } = await supabaseAdmin()
      .from("pages")
      .select("*")
      .eq("website_id", website.id)
      .eq("id", pageId)
      .maybeSingle();
    if (loadError) throw loadError;
    if (!existing) return apiError(404, "not_found");

    const page = existing as Page;
    if (!page.draft) {
      return apiError(400, "Nothing to publish — no unsaved changes.");
    }

    const d = page.draft;
    const baseUpdate = {
      title: d.title,
      hero_heading: d.hero_heading,
      hero_subheading: d.hero_subheading,
      hero_image_url: d.hero_image_url,
      content: d.content,
      seo_title: d.seo_title,
      seo_description: d.seo_description,
      seo_keyphrase: d.seo_keyphrase,
      draft: null,
      updated_at: new Date().toISOString(),
    };

    async function applyUpdate(withOverrides: boolean) {
      return supabaseAdmin()
        .from("pages")
        .update(
          withOverrides
            ? { ...baseUpdate, content_overrides: d.overrides ?? null }
            : baseUpdate
        )
        .eq("website_id", website.id)
        .eq("id", pageId)
        .select("*")
        .single();
    }

    let { data, error } = await applyUpdate(true);
    // Gracefully degrade if the content_overrides column hasn't been migrated.
    if (error && /content_overrides/.test(error.message ?? "")) {
      ({ data, error } = await applyUpdate(false));
    }
    if (error) throw error;

    let revalidated = false;
    if (website.domain) {
      const path = page.slug === "home" ? "/" : `/${page.slug}`;
      revalidated = await revalidateSite(website.domain, path);
    }

    return NextResponse.json({ page: data, revalidated });
  } catch (e) {
    return handleApiError(e);
  }
}
