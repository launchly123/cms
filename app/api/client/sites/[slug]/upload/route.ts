import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError, handleApiError } from "@/lib/http";
import { getEditorAccess } from "@/lib/clientAccess";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

/** Image upload for the client editor (client session or owner). */
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

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return apiError(400, "No file provided");
    if (!file.type.startsWith("image/")) {
      return apiError(400, "Only image files are allowed");
    }
    if (file.size > MAX_SIZE) return apiError(400, "Image must be under 10MB");

    const ext =
      (file.name.split(".").pop() || "png")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "") || "png";
    const path = `${website.id}/${crypto.randomUUID()}.${ext}`;

    const { error } = await supabaseAdmin()
      .storage.from("images")
      .upload(path, Buffer.from(await file.arrayBuffer()), {
        contentType: file.type,
      });
    if (error) throw error;

    const { data } = supabaseAdmin().storage.from("images").getPublicUrl(path);
    return NextResponse.json({ url: data.publicUrl });
  } catch (e) {
    return handleApiError(e);
  }
}
