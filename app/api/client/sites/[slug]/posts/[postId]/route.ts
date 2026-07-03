import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError, handleApiError } from "@/lib/http";
import { parseJson, postDraftSchema } from "@/lib/validation";
import { getEditorAccess } from "@/lib/clientAccess";

/** Save the visual editor's draft for a blog post. */
export async function PUT(
  req: Request,
  ctx: { params: Promise<{ slug: string; postId: string }> }
) {
  try {
    const { slug, postId } = await ctx.params;
    const result = await getEditorAccess(slug);
    if (!result.ok) {
      return apiError(result.reason === "not_found" ? 404 : 401, result.reason);
    }
    const { website } = result.access;

    const parsed = await parseJson(req, postDraftSchema);
    if (parsed.error) {
      return apiError(400, parsed.error.message, parsed.error.issues);
    }

    const { data, error } = await supabaseAdmin()
      .from("blog_posts")
      .update({ draft: parsed.data, updated_at: new Date().toISOString() })
      .eq("website_id", website.id)
      .eq("id", postId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) return apiError(404, "not_found");
    return NextResponse.json({ post: data });
  } catch (e) {
    return handleApiError(e);
  }
}
