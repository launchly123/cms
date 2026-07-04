import Anthropic from "@anthropic-ai/sdk";
import type { PageDraft } from "@/lib/types";
import type { AppSettings } from "@/lib/settings";

export function aiConfigured(s: AppSettings): boolean {
  return Boolean(s.ai_provider && s.ai_api_key && s.ai_model);
}

/** The editable slice of a page we let the AI rewrite (no images, no slug). */
interface EditableContent {
  title: string;
  hero_heading: string;
  hero_subheading: string;
  sections: { id: string; heading: string; body: string }[];
  seo_title: string;
  seo_description: string;
  seo_keyphrase: string;
}

function toEditable(page: PageDraft): EditableContent {
  return {
    title: page.title,
    hero_heading: page.hero_heading ?? "",
    hero_subheading: page.hero_subheading ?? "",
    sections: page.content.map((s) => ({
      id: s.id,
      heading: s.heading,
      body: s.body,
    })),
    seo_title: page.seo_title ?? "",
    seo_description: page.seo_description ?? "",
    seo_keyphrase: page.seo_keyphrase ?? "",
  };
}

/** Merge the AI's edited content back onto the draft, preserving images/slug. */
function applyEditable(page: PageDraft, edited: EditableContent): PageDraft {
  const byId = new Map(page.content.map((s) => [s.id, s]));
  return {
    ...page,
    title: edited.title || page.title,
    hero_heading: edited.hero_heading || null,
    hero_subheading: edited.hero_subheading || null,
    content: edited.sections.map((s) => ({
      id: s.id,
      heading: s.heading ?? "",
      body: s.body ?? "",
      image_url: byId.get(s.id)?.image_url ?? null,
    })),
    seo_title: edited.seo_title || null,
    seo_description: edited.seo_description || null,
    seo_keyphrase: edited.seo_keyphrase || null,
  };
}

const SYSTEM_PROMPT = `You are a website content editor inside a CMS. You receive the current page content as JSON and an instruction from the user. Apply the instruction and return the UPDATED content.

Rules:
- Return ONLY a single JSON object, no prose, no markdown fences.
- Keep the exact same JSON shape and keys you were given.
- Keep every section's "id" unchanged. Do not add or remove sections unless the instruction explicitly asks.
- Only change text. Do not invent URLs or images.
- Write natural, polished marketing copy that fits the site.`;

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("ai_no_json");
  }
  return JSON.parse(text.slice(start, end + 1));
}

async function callAnthropic(
  settings: AppSettings,
  userContent: string
): Promise<string> {
  const client = new Anthropic({ apiKey: settings.ai_api_key! });
  const msg = await client.messages.create({
    model: settings.ai_model!,
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });
  const block = msg.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("ai_empty");
  return block.text;
}

async function callOpenRouter(
  settings: AppSettings,
  userContent: string
): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.ai_api_key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: settings.ai_model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`ai_provider_error_${res.status}`);
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text) throw new Error("ai_empty");
  return text;
}

/**
 * Apply a natural-language instruction to a page's content via the configured
 * AI provider. Returns the updated draft (images and slug preserved).
 */
export async function aiEditPage(
  settings: AppSettings,
  instruction: string,
  page: PageDraft
): Promise<PageDraft> {
  const editable = toEditable(page);
  const userContent = `Current page content:\n${JSON.stringify(
    editable,
    null,
    2
  )}\n\nInstruction:\n${instruction}\n\nReturn the updated JSON object.`;

  const raw =
    settings.ai_provider === "openrouter"
      ? await callOpenRouter(settings, userContent)
      : await callAnthropic(settings, userContent);

  const parsed = extractJson(raw) as EditableContent;
  // Defensive: ensure sections is an array.
  if (!Array.isArray(parsed.sections)) parsed.sections = editable.sections;
  return applyEditable(page, parsed);
}
