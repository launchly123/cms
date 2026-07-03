import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError, handleApiError } from "@/lib/http";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const websiteId = form.get("websiteId");

    if (!(file instanceof File)) {
      return apiError(400, "No file provided");
    }
    if (typeof websiteId !== "string" || !websiteId) {
      return apiError(400, "Missing websiteId");
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(websiteId)) {
      return apiError(400, "Invalid websiteId");
    }
    if (!file.type.startsWith("image/")) {
      return apiError(400, "Only image files are allowed");
    }
    if (file.size > MAX_SIZE) {
      return apiError(400, "Image must be under 10MB");
    }

    const ext =
      (file.name.split(".").pop() || "png")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "") || "png";
    const path = `${websiteId}/${crypto.randomUUID()}.${ext}`;

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
