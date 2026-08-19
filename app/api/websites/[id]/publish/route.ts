import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError, handleApiError } from "@/lib/http";
import { revalidateSite, triggerDeployHook } from "@/lib/vercel";
import type { Website } from "@/lib/types";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;

    // Body is optional JSON: { action?: "publish" | "unpublish" }.
    const body: unknown = await req.json().catch(() => ({}));
    const action =
      body && typeof body === "object" && "action" in body
        ? (body as { action?: unknown }).action ?? "publish"
        : "publish";
    if (action !== "publish" && action !== "unpublish") {
      return apiError(400, 'action must be "publish" or "unpublish"');
    }

    const supabase = supabaseAdmin();
    const { data: website, error } = await supabase
      .from("websites")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    if (!website) return apiError(404, "not_found");

    const site = website as Website;

    if (action === "unpublish") {
      const { data: updated, error: updateError } = await supabase
        .from("websites")
        .update({ status: "draft", updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (updateError) throw updateError;
      return NextResponse.json({
        ok: true,
        deployed: false,
        revalidated: false,
        website: updated,
      });
    }

    const deployed = site.deploy_hook_url
      ? await triggerDeployHook(site.deploy_hook_url)
      : false;
    const revalidated = site.domain ? await revalidateSite(site.domain) : false;

    const { data: updated, error: updateError } = await supabase
      .from("websites")
      .update({ status: "live", updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (updateError) throw updateError;

    return NextResponse.json({
      ok: true,
      deployed,
      revalidated,
      website: updated,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
