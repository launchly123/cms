import { supabaseAdmin } from "@/lib/supabase";

export type AiProvider = "anthropic" | "openrouter";

export interface AppSettings {
  ai_provider: AiProvider | null;
  ai_model: string | null;
  ai_api_key: string | null;
  public_address: string | null;
}

/** Public-safe view of settings — never includes the AI key. */
export interface PublicSettings {
  ai_provider: AiProvider | null;
  ai_model: string | null;
  ai_configured: boolean;
  public_address: string | null;
}

const DEFAULTS: AppSettings = {
  ai_provider: null,
  ai_model: null,
  ai_api_key: null,
  public_address: null,
};

/** Postgres/PostgREST "relation does not exist" — the migration hasn't run. */
function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /app_settings/.test(error.message ?? "") && /(does not exist|schema cache)/i.test(error.message ?? "")
  );
}

/** Full settings incl. the secret key — server-side only, never send to client. */
export async function getSettings(): Promise<AppSettings> {
  const { data, error } = await supabaseAdmin()
    .from("app_settings")
    .select("ai_provider, ai_model, ai_api_key, public_address")
    .eq("id", 1)
    .maybeSingle();
  // Before the migration runs, behave as "nothing configured yet".
  if (error) {
    if (isMissingTable(error)) return { ...DEFAULTS };
    throw error;
  }
  return { ...DEFAULTS, ...(data ?? {}) } as AppSettings;
}

export function toPublicSettings(s: AppSettings): PublicSettings {
  return {
    ai_provider: s.ai_provider,
    ai_model: s.ai_model,
    ai_configured: Boolean(s.ai_api_key),
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
  public_address?: string | null;
}): Promise<PublicSettings> {
  const current = await getSettings();
  const merged: AppSettings = {
    ai_provider: patch.ai_provider ?? current.ai_provider,
    ai_model: patch.ai_model ?? current.ai_model,
    ai_api_key:
      patch.ai_api_key === undefined
        ? current.ai_api_key
        : patch.ai_api_key === ""
          ? null
          : patch.ai_api_key,
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
