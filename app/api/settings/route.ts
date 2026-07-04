import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, handleApiError } from "@/lib/http";
import { parseJson } from "@/lib/validation";
import { getPublicSettings, updateSettings } from "@/lib/settings";
import { vercelConfigured } from "@/lib/vercel";
import { supabaseConfigured } from "@/lib/supabase";

// Owner-only (protected by middleware). Returns connection statuses + settings.
export async function GET() {
  try {
    const settings = await getPublicSettings();
    return NextResponse.json({
      settings,
      status: {
        database: supabaseConfigured(),
        vercel: vercelConfigured(),
        ai: settings.ai_configured,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}

const updateSchema = z.object({
  ai_provider: z.enum(["anthropic", "openrouter"]).nullable().optional(),
  ai_model: z.string().trim().max(200).nullable().optional(),
  ai_api_key: z.string().max(500).optional(), // "" clears; omitted keeps
  public_address: z.string().trim().max(300).nullable().optional(),
});

export async function PUT(req: Request) {
  try {
    const parsed = await parseJson(req, updateSchema);
    if (parsed.error) {
      return apiError(400, parsed.error.message, parsed.error.issues);
    }
    const settings = await updateSettings(parsed.data);
    return NextResponse.json({ settings });
  } catch (e) {
    return handleApiError(e);
  }
}
