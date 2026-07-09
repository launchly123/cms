import { NextResponse } from "next/server";
import { apiError, handleApiError } from "@/lib/http";
import { parseJson, pageDraftSchema } from "@/lib/validation";
import { z } from "zod";
import { getEditorAccess } from "@/lib/clientAccess";
import { checkAndReserveAiUsage, getSettings } from "@/lib/settings";
import { aiConfigured, aiEditPage } from "@/lib/ai";

const bodySchema = z.object({
  instruction: z.string().trim().min(1, "Describe the change").max(2000),
  page: pageDraftSchema,
});

/**
 * Apply a natural-language edit to a page draft via the configured AI provider.
 * Returns the updated draft plus today's usage — the client saves the draft
 * like any other draft and shows a warning as usage nears the daily limit.
 */
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

    const settings = await getSettings();
    if (!aiConfigured(settings)) {
      return apiError(
        400,
        "AI editing isn't set up yet. Add an AI provider and key in Settings."
      );
    }

    const usage = await checkAndReserveAiUsage();
    if (!usage.allowed) {
      return apiError(
        429,
        `You've used all ${usage.limit} free AI edits for today. It resets at midnight — or raise the daily limit in Settings.`,
        undefined
      );
    }

    const parsed = await parseJson(req, bodySchema);
    if (parsed.error) {
      return apiError(400, parsed.error.message, parsed.error.issues);
    }

    try {
      const updated = await aiEditPage(
        settings,
        parsed.data.instruction,
        parsed.data.page
      );
      return NextResponse.json({
        page: updated,
        usage: { count: usage.count, limit: usage.limit },
      });
    } catch (e) {
      console.error("[ai-edit]", e);
      return apiError(
        502,
        "The AI couldn't complete that edit. Try rephrasing, or check your AI key in Settings."
      );
    }
  } catch (e) {
    return handleApiError(e);
  }
}
