import Anthropic from "@anthropic-ai/sdk";
import type { PageDraft } from "@/lib/types";
import type { AppSettings } from "@/lib/settings";

export function aiConfigured(s: AppSettings): boolean {
  return Boolean(s.ai_provider && s.ai_api_key && s.ai_model);
}

/** The editable slice of a page we let the AI read/rewrite (no images, no slug). */
interface EditableContent {
  title: string;
  hero_heading: string;
  hero_subheading: string;
  sections: { id: string; heading: string; body: string }[];
  seo_title: string;
  seo_description: string;
  seo_keyphrase: string;
}

interface AiResult {
  reply: string;
  content: EditableContent;
  edited: boolean;
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

const SYSTEM_PROMPT = `You are a friendly assistant built into a website's content editor. You chat with a non-technical client who is editing their site's text.

What you can see: only this page's TEXT — title, hero heading/subheading, section headings/bodies, and SEO fields (given to you as JSON).
What you CANNOT see: the site's visual design — fonts, colors, layout, spacing, images, or CSS. If asked about any of those, say plainly that you can only see and edit the page's text content, not its design, so you can't answer that — then offer to help with the text instead. Never guess or make up an answer about the design.

Behavior:
- If the user asks a question or is just chatting, answer conversationally in "reply", set "edited" to false, and copy "content" back EXACTLY character-for-character as given — do not retype it, do not fix typos, do not touch accents (ñ, á, é, etc.) or punctuation, even by accident.
- If the user asks you to change/write/edit something, make that specific change in "content", set "edited" to true, and put a short, friendly one-sentence confirmation in "reply" (e.g. "Done — I made the headline punchier.").
- When "edited" is true, only change the fields the user actually asked about — leave every other field byte-for-byte identical to the input, including accents and punctuation.
- Keep "content"'s keys and shape exactly as given. Keep every section's "id" unchanged. Do not add or remove sections unless explicitly asked. Don't invent URLs or images.
- Match the site's existing language and tone when writing new copy.
- Keep "reply" short — one or two sentences, plain text, no markdown.

Always respond with ONLY a single JSON object, no prose outside it, no markdown fences, in exactly this shape:
{"reply": "<your chat message>", "edited": true or false, "content": { "title": "...", "hero_heading": "...", "hero_subheading": "...", "sections": [...], "seo_title": "...", "seo_description": "...", "seo_keyphrase": "..." }}`;

/**
 * Try hard to get {reply, edited, content} out of a model response, however
 * messy. Free/small models sometimes retype fields even when told not to
 * (e.g. dropping an accent) — so unless the model explicitly signals
 * edited:true, we ALWAYS keep the original content untouched, never the
 * model's echoed copy. That guarantees a question can never corrupt the page.
 */
function parseAiResult(raw: string, fallback: EditableContent): AiResult {
  const candidates: string[] = [raw.trim()];
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    candidates.push(raw.slice(start, end + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object") {
        const reply = typeof parsed.reply === "string" ? parsed.reply : "";
        const edited = parsed.edited === true;
        let content = fallback;
        if (edited && parsed.content && typeof parsed.content === "object") {
          content = parsed.content as EditableContent;
          if (!Array.isArray(content.sections)) content.sections = fallback.sections;
        }
        if (reply || parsed.content) return { reply: reply || "Done.", edited, content };
      }
    } catch {
      // try next candidate
    }
  }

  // Model ignored the JSON format entirely — treat its whole reply as a chat
  // answer and leave the page untouched, so questions still get answered.
  return {
    reply: raw.trim() || "I didn't quite catch that — could you rephrase?",
    edited: false,
    content: fallback,
  };
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
 * Chat with the AI about this page. Answers questions conversationally and/or
 * applies a requested edit — either way, the client always gets something to
 * read back. Returns the (possibly updated) draft plus the chat reply.
 */
export async function aiEditPage(
  settings: AppSettings,
  instruction: string,
  page: PageDraft
): Promise<{ reply: string; page: PageDraft; edited: boolean }> {
  const editable = toEditable(page);
  const userContent = `Current page content:\n${JSON.stringify(
    editable,
    null,
    2
  )}\n\nUser message:\n${instruction}\n\nRespond with the JSON object described in your instructions.`;

  const raw =
    settings.ai_provider === "openrouter"
      ? await callOpenRouter(settings, userContent)
      : await callAnthropic(settings, userContent);

  const { reply, edited, content } = parseAiResult(raw, editable);
  // edited=false means content is guaranteed to be `editable` (the untouched
  // original) — applyEditable is a no-op merge in that case, page unchanged.
  return { reply, page: applyEditable(page, content), edited };
}
