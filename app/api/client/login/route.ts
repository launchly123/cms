import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError, handleApiError } from "@/lib/http";
import { parseJson } from "@/lib/validation";
import {
  clientCookieName,
  createSessionToken,
  verifyPassword,
} from "@/lib/clientAuth";

const loginSchema = z.object({
  slug: z.string().trim().min(1).max(100),
  password: z.string().min(1, "Password is required").max(100),
});

export async function POST(req: Request) {
  try {
    const parsed = await parseJson(req, loginSchema);
    if (parsed.error) {
      return apiError(400, parsed.error.message, parsed.error.issues);
    }
    const { slug, password } = parsed.data;

    const { data: website, error } = await supabaseAdmin()
      .from("websites")
      .select("id, client_password_hash")
      .eq("slug", slug)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    if (!website) return apiError(404, "not_found");
    if (!website.client_password_hash) {
      return apiError(403, "This site doesn't have client access set up yet. Ask your agency to set a password.");
    }
    if (!verifyPassword(password, website.client_password_hash)) {
      return apiError(401, "Wrong password. Please try again.");
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set(clientCookieName(website.id), createSessionToken(website.id), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });
    return res;
  } catch (e) {
    return handleApiError(e);
  }
}
