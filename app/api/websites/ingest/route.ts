import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError, handleApiError, isUniqueViolation } from "@/lib/http";
import { parseJson, slugify } from "@/lib/validation";

const ingestSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(100),
    url: z.string().trim().max(500).optional(),
    html: z.string().max(500000).optional(),
  })
  .refine((v) => v.url || v.html, {
    message: "Provide a website URL or paste its HTML",
  });

/** Extract the hostname from a URL, tolerating a missing scheme. */
function hostFromUrl(url: string): string | null {
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    return u.host;
  } catch {
    return null;
  }
}

/**
 * Add a website by URL (or pasted HTML). Creates the website plus a starter
 * "home" page. URL sites get their domain set so the visual editor loads the
 * real live page; HTML-only sites fall back to the template editor.
 */
export async function POST(req: Request) {
  try {
    const parsed = await parseJson(req, ingestSchema);
    if (parsed.error) {
      return apiError(400, parsed.error.message, parsed.error.issues);
    }
    const { name, url } = parsed.data;
    const domain = url ? hostFromUrl(url) : null;
    if (url && !domain) {
      return apiError(400, "That doesn't look like a valid website address.");
    }

    const supabase = supabaseAdmin();
    const base = slugify(name);

    async function insertWebsite(slug: string) {
      return supabase
        .from("websites")
        .insert({ name, slug, domain, status: "draft" })
        .select()
        .single();
    }

    let result = await insertWebsite(base);
    if (result.error && isUniqueViolation(result.error)) {
      result = await insertWebsite(
        `${base}-${Math.floor(1000 + Math.random() * 9000)}`
      );
    }
    if (result.error) throw result.error;
    const website = result.data;

    // Seed a home page so the editor has something to open.
    await supabase
      .from("pages")
      .insert({
        website_id: website.id,
        slug: "home",
        title: "Home",
        content: [],
      });

    return NextResponse.json({ website });
  } catch (e) {
    return handleApiError(e);
  }
}
