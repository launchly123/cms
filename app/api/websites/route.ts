import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError, handleApiError, isUniqueViolation } from "@/lib/http";
import { parseJson, slugify, websiteCreateSchema } from "@/lib/validation";

export async function GET() {
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("websites")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ websites: data ?? [] });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: Request) {
  try {
    const parsed = await parseJson(req, websiteCreateSchema);
    if (parsed.error) {
      return apiError(400, parsed.error.message, parsed.error.issues);
    }
    const { name, slug, domain } = parsed.data;

    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("websites")
      .insert({
        name,
        slug: slug ?? slugify(name),
        domain: domain ?? null,
        status: "draft",
      })
      .select()
      .single();

    if (error) {
      if (isUniqueViolation(error)) {
        return apiError(409, "That slug is already in use");
      }
      throw error;
    }
    return NextResponse.json({ website: data });
  } catch (e) {
    return handleApiError(e);
  }
}
