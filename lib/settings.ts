import { supabaseAdmin } from "@/lib/supabase";

export type AiProvider = "anthropic" | "openrouter";

export interface AppSettings {
  ai_provider: AiProvider | null;
  ai_model: string | null;
  ai_api_key: string | null;
  ai_daily_limit: number;
  ai_daily_count: number;
  ai_daily_date: string | null; // YYYY-MM-DD
  public_address: string | null;
}

/** Public-safe view of settings — never includes the AI key. */
export interface PublicSettings {
  ai_provider: AiProvider | null;
  ai_model: string | null;
  ai_configured: boolean;
  ai_daily_limit: number;
  ai_daily_count: number;
  public_address: string | null;
}

const DEFAULTS: AppSettings = {
  ai_provider: null,
  ai_model: null,
  ai_api_key: null,
  ai_daily_limit: 50,
  ai_daily_count: 0,
  ai_daily_date: null,
  public_address: null,
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Postgres/PostgREST "relation/column does not exist" — the migration hasn't run. */
function isMissingSchema(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "42703" ||
    error.code === "PGRST205" ||
    (/app_settings/.test(error.message ?? "") &&
      /(does not exist|schema cache)/i.test(error.message ?? ""))
  );
}

/**
 * Full settings incl. the secret key — server-side only, never send to client.
 * Automatically zeroes ai_daily_count when the stored date isn't today.
 */
export async function getSettings(): Promise<AppSettings> {
  const { data, error } = await supabaseAdmin()
    .from("app_settings")
    .select(
      "ai_provider, ai_model, ai_api_key, ai_daily_limit, ai_daily_count, ai_daily_date, public_address"
    )
    .eq("id", 1)
    .maybeSingle();
  // Before the migration runs, behave as "nothing configured yet".
  if (error) {
    if (isMissingSchema(error)) return { ...DEFAULTS };
    throw error;
  }
  const merged = { ...DEFAULTS, ...(data ?? {}) } as AppSettings;
  if (merged.ai_daily_date !== today()) {
    merged.ai_daily_count = 0;
    merged.ai_daily_date = today();
  }
  return merged;
}

export function toPublicSettings(s: AppSettings): PublicSettings {
  return {
    ai_provider: s.ai_provider,
    ai_model: s.ai_model,
    ai_configured: Boolean(s.ai_api_key),
    ai_daily_limit: s.ai_daily_limit,
    ai_daily_count: s.ai_daily_date === today() ? s.ai_daily_count : 0,
    public_address: s.public_address,
  };
}

export async function getPublicSettings(): Promise<PublicSettings> {
  return toPublicSettings(await getSettings());
}

/**
 * Upsert settings. Only provided fields change. Pass ai_api_key: "" to clear.
 */
export async function updateSettings(patch: {
  ai_provider?: AiProvider | null;
  ai_model?: string | null;
  ai_api_key?: string | null;
  ai_daily_limit?: number;
  public_address?: string | null;
}): Promise<PublicSettings> {
  const current = await getSettings();
  const merged: AppSettings = {
    ...current,
    ai_provider: patch.ai_provider ?? current.ai_provider,
    ai_model: patch.ai_model ?? current.ai_model,
    ai_api_key:
      patch.ai_api_key === undefined
        ? current.ai_api_key
        : patch.ai_api_key === ""
          ? null
          : patch.ai_api_key,
    ai_daily_limit:
      patch.ai_daily_limit !== undefined && patch.ai_daily_limit > 0
        ? Math.floor(patch.ai_daily_limit)
        : current.ai_daily_limit,
    public_address:
      patch.public_address === undefined
        ? current.public_address
        : patch.public_address || null,
  };

  const { error } = await supabaseAdmin()
    .from("app_settings")
    .upsert(
      { id: 1, ...merged, updated_at: new Date().toISOString() },
      { onConflict: "id" }
    );
  if (error) throw error;
  return toPublicSettings(merged);
}

export interface UsageCheck {
  allowed: boolean;
  count: number;
  limit: number;
}

/** Read-only check — does NOT consume a usage slot. Call before running the AI edit. */
export async function peekAiUsage(): Promise<UsageCheck> {
  const settings = await getSettings();
  return {
    allowed: settings.ai_daily_count < settings.ai_daily_limit,
    count: settings.ai_daily_count,
    limit: settings.ai_daily_limit,
  };
}

/**
 * Persist +1 on today's usage counter. Call ONLY after a successful AI edit —
 * failed attempts (bad model, provider error, etc.) must not cost the client
 * part of their daily free quota.
 */
export async function incrementAiUsage(): Promise<UsageCheck> {
  const settings = await getSettings();
  const nextCount = settings.ai_daily_count + 1;
  const { error } = await supabaseAdmin()
    .from("app_settings")
    .upsert(
      {
        id: 1,
        ...settings,
        ai_daily_count: nextCount,
        ai_daily_date: today(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
  if (error && !isMissingSchema(error)) throw error;
  return { allowed: true, count: nextCount, limit: settings.ai_daily_limit };
}
