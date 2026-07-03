import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError, handleApiError, isUniqueViolation } from "@/lib/http";
import { parseJson, slugify } from "@/lib/validation";
import { getEditorAccess } from "@/lib/clientAccess";

const createSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
});

/** Create a new page from the visual editor. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await ctx.params;
    const result = await getEditorAccess(slug);
    if (!result.ok) {
      return apiError(result.reason === "not_found" ? 404 : 401, result.reason);
    }
    const { website } = result.access;

    const parsed = await parseJson(req, createSchema);
    if (parsed.error) {
      return apiError(400, parsed.error.message, parsed.error.issues);
    }
    const { title } = parsed.data;
    const base = slugify(title);

    let insert = await supabaseAdmin()
      .from("pages")
      .insert({ website_id: website.id, slug: base, title, content: [] })
      .select("*")
      .single();

    if (insert.error && isUniqueViolation(insert.error)) {
      insert = await supabaseAdmin()
        .from("pages")
        .insert({
          website_id: website.id,
          slug: `${base}-${Math.floor(1000 + Math.random() * 9000)}`,
          title,
          content: [],
        })
        .select("*")
        .single();
    }
    if (insert.error) throw insert.error;
    return NextResponse.json({ page: insert.data });
  } catch (e) {
    return handleApiError(e);
  }
}
