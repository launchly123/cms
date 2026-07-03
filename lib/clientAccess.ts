import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { clientCookieName, verifySessionToken } from "@/lib/clientAuth";
import type { Website } from "@/lib/types";

export type EditorRole = "owner" | "client";

export interface EditorAccess {
  website: Website;
  role: EditorRole;
}

/**
 * Resolve access to the client editor for a website slug.
 * Owner = signed-in Clerk user (full dashboard access anyway).
 * Client = valid per-site session cookie created by /api/client/login.
 * Returns null when the caller has neither.
 */
export async function getEditorAccess(slug: string): Promise<
  | { ok: true; access: EditorAccess }
  | { ok: false; reason: "not_found" | "no_access"; website?: Pick<Website, "id" | "name" | "slug"> }
> {
  const { data, error } = await supabaseAdmin()
    .from("websites")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, reason: "not_found" };
  const website = data as Website;

  const { userId } = await auth();
  if (userId) return { ok: true, access: { website, role: "owner" } };

  const cookieStore = await cookies();
  const token = cookieStore.get(clientCookieName(website.id))?.value;
  if (verifySessionToken(token, website.id)) {
    return { ok: true, access: { website, role: "client" } };
  }

  return {
    ok: false,
    reason: "no_access",
    website: { id: website.id, name: website.name, slug: website.slug },
  };
}

/** Strip fields clients must never see (password hash, tokens). */
export function publicWebsite(site: Website) {
  return {
    id: site.id,
    name: site.name,
    slug: site.slug,
    domain: site.domain,
    status: site.status,
    has_client_password: Boolean(site.client_password_hash),
  };
}
