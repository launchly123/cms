"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Banner,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Spinner,
  useFlash,
} from "@/app/components/ui";

interface SettingsData {
  ai_provider: "anthropic" | "openrouter" | null;
  ai_model: string | null;
  ai_configured: boolean;
  ai_daily_limit: number;
  ai_daily_count: number;
  public_address: string | null;
}

function ConnectedChip({ ok, label }: { ok: boolean; label: string }) {
  return ok ? (
    <Badge color="green">connected · {label}</Badge>
  ) : (
    <Badge color="gray">not connected</Badge>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<React.ReactNode | null>(null);
  const [flash, setFlash] = useFlash();

  const [settings, setSettings] = React.useState<SettingsData | null>(null);
  const [status, setStatus] = React.useState({ database: false, vercel: false, ai: false });

  // AI editing form
  const [provider, setProvider] = React.useState<"anthropic" | "openrouter">("openrouter");
  const [model, setModel] = React.useState("deepseek/deepseek-r1:free");
  const [apiKey, setApiKey] = React.useState("");
  const [dailyLimit, setDailyLimit] = React.useState(50);
  const [savingAi, setSavingAi] = React.useState(false);

  // Public address
  const [publicAddress, setPublicAddress] = React.useState("");
  const [savingAddr, setSavingAddr] = React.useState(false);

  // Add a website
  const [siteName, setSiteName] = React.useState("");
  const [siteUrl, setSiteUrl] = React.useState("");
  const [ingesting, setIngesting] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/settings");
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(
            data.error === "supabase_not_configured"
              ? "Supabase isn't connected yet — finish setup on the Websites page."
              : "Couldn't load settings. Refresh to try again."
          );
          return;
        }
        const s: SettingsData = data.settings;
        setSettings(s);
        setStatus(data.status);
        if (s.ai_provider) setProvider(s.ai_provider);
        if (s.ai_model) setModel(s.ai_model);
        if (s.ai_daily_limit) setDailyLimit(s.ai_daily_limit);
        setPublicAddress(s.public_address ?? "");
      } catch {
        if (!cancelled) setError("Couldn't load settings. Refresh to try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveAi() {
    setSavingAi(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        ai_provider: provider,
        ai_model: model.trim(),
        ai_daily_limit: dailyLimit,
      };
      if (apiKey.trim()) body.ai_api_key = apiKey.trim();
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Couldn't save.");
        return;
      }
      setSettings(data.settings);
      setStatus((st) => ({ ...st, ai: data.settings.ai_configured }));
      setApiKey("");
      setFlash("AI settings saved");
    } catch {
      setError("Couldn't save. Please try again.");
    } finally {
      setSavingAi(false);
    }
  }

  async function savePublicAddress() {
    setSavingAddr(true);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_address: publicAddress.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Couldn't save.");
        return;
      }
      setFlash("Saved");
    } catch {
      setError("Couldn't save. Please try again.");
    } finally {
      setSavingAddr(false);
    }
  }

  async function ingest(e: React.FormEvent) {
    e.preventDefault();
    setIngesting(true);
    setError(null);
    try {
      const res = await fetch("/api/websites/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: siteName.trim(), url: siteUrl.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          Array.isArray(data.details) && data.details.length
            ? data.details.join(" ")
            : typeof data.error === "string"
              ? data.error
              : "Couldn't add the site."
        );
        return;
      }
      router.push(`/sites/${data.website.id}`);
    } catch {
      setError("Couldn't add the site. Please try again.");
    } finally {
      setIngesting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  const modelPlaceholder =
    provider === "anthropic" ? "claude-opus-4-8" : "deepseek/deepseek-r1:free";
  const keyPlaceholder = provider === "anthropic" ? "sk-ant-…" : "sk-or-…";

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <PageHeader
        title="Agency Console"
        description="Connect your tools once. Every client site runs on them."
        actions={
          <div className="flex items-center gap-2">
            <ConnectedChip ok={status.ai} label="AI" />
            <ConnectedChip ok={status.vercel} label="Vercel" />
            <ConnectedChip ok={status.database} label="Supabase" />
          </div>
        }
      />

      {flash && <Banner kind="success">{flash}</Banner>}
      {error && (
        <Banner kind="error" onDismiss={() => setError(null)}>
          {error}
        </Banner>
      )}

      <div className="space-y-6">
        {/* AI editing */}
        <Card className="p-5">
          <div className="mb-1 flex items-center gap-2">
            <h2 className="text-sm font-semibold">🤖 AI editing</h2>
            {settings?.ai_configured ? (
              <Badge color="green">connected · {settings.ai_provider}</Badge>
            ) : (
              <Badge color="gray">not set up</Badge>
            )}
          </div>
          <p className="mb-4 text-sm text-muted">
            Powers the &ldquo;describe a change&rdquo; chat in the editor.
            Click-to-edit works without it. Your key is stored on your server and
            never shown again.
          </p>

          <div className="mb-4 grid grid-cols-2 gap-2">
            {(["anthropic", "openrouter"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setProvider(p);
                  setModel(p === "anthropic" ? "claude-opus-4-8" : "deepseek/deepseek-r1:free");
                }}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  provider === p
                    ? "border-foreground bg-card-hover"
                    : "border-border hover:bg-card-hover"
                }`}
              >
                <div className="text-sm font-medium">
                  {p === "anthropic" ? "Anthropic" : "OpenRouter"}
                </div>
                <div className="text-xs text-muted">
                  {p === "anthropic" ? "Claude — direct, paid" : "Free models available — no card"}
                </div>
              </button>
            ))}
          </div>

          {provider === "openrouter" && (
            <p className="mb-4 text-xs text-muted">
              OpenRouter has genuinely free models (no credit card, no charges).
              Get a key at{" "}
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-foreground"
              >
                openrouter.ai/keys
              </a>
              . Free models are limited to ~50 requests/day (1,000/day if you
              ever add $10 in credit) — the daily limit below keeps you safely
              under that.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="API key" hint={settings?.ai_configured ? "A key is saved. Enter a new one to replace it." : undefined}>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={keyPlaceholder}
              />
            </Field>
            <Field label="Model">
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={modelPlaceholder}
              />
            </Field>
          </div>

          <div className="mt-4">
            <Field
              label="Daily edit limit"
              hint="Once this many AI edits happen in a day, the editor shows a warning and stops until midnight."
            >
              <Input
                type="number"
                min={1}
                value={dailyLimit}
                onChange={(e) => setDailyLimit(Math.max(1, Number(e.target.value) || 1))}
                className="max-w-[10rem]"
              />
            </Field>
            {settings && (
              <p className="mt-2 text-xs text-muted">
                Used today:{" "}
                <span
                  className={
                    settings.ai_daily_count >= settings.ai_daily_limit
                      ? "text-red-400"
                      : settings.ai_daily_count / Math.max(1, settings.ai_daily_limit) >= 0.8
                        ? "text-amber-400"
                        : "text-foreground"
                  }
                >
                  {settings.ai_daily_count}/{settings.ai_daily_limit}
                </span>{" "}
                — resets at midnight.
              </p>
            )}
          </div>

          <div className="mt-4 flex justify-end">
            <Button loading={savingAi} onClick={saveAi}>
              Save key
            </Button>
          </div>
        </Card>

        {/* Vercel hosting */}
        <Card className="p-5">
          <div className="mb-1 flex items-center gap-2">
            <h2 className="text-sm font-semibold">▲ Vercel hosting</h2>
            <ConnectedChip ok={status.vercel} label="token" />
          </div>
          <p className="text-sm text-muted">
            Your Vercel token is set on the server. New Vercel projects sync into
            your Websites list automatically, and publishing can trigger a
            redeploy. To change the token, update <code className="font-mono text-xs bg-card-hover px-1 py-0.5 rounded">VERCEL_API_TOKEN</code> in your environment.
          </p>
        </Card>

        {/* Database */}
        <Card className="p-5">
          <div className="mb-1 flex items-center gap-2">
            <h2 className="text-sm font-semibold">🗄 Database</h2>
            <ConnectedChip ok={status.database} label="Supabase" />
          </div>
          <p className="text-sm text-muted">
            Your content, drafts, version history and client passwords are stored
            in <strong>Supabase</strong> — a real database that survives restarts.
            Nothing to set up here.
          </p>
        </Card>

        {/* Add a website */}
        <Card className="p-5">
          <h2 className="mb-1 text-sm font-semibold">➕ Add a website</h2>
          <p className="mb-4 text-sm text-muted">
            Paste the address of a site you&apos;ve already built &amp; deployed —
            it becomes editable in your dashboard. Set a client password on its
            card once you&apos;re ready to hand it over.
          </p>
          <form onSubmit={ingest} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Site name">
                <Input
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  placeholder="e.g. Acme"
                  required
                />
              </Field>
              <Field label="Website URL">
                <Input
                  value={siteUrl}
                  onChange={(e) => setSiteUrl(e.target.value)}
                  placeholder="https://the-site-you-built.com"
                />
              </Field>
            </div>
            <div className="flex justify-end">
              <Button type="submit" loading={ingesting}>
                Add site
              </Button>
            </div>
          </form>
        </Card>

        {/* Public address */}
        <Card className="p-5">
          <h2 className="mb-1 text-sm font-semibold">🔗 Public address clients log in at</h2>
          <p className="mb-4 text-sm text-muted">
            The web address you send clients (this CMS&apos;s own URL). Shown on
            each site&apos;s client-access card.
          </p>
          <div className="flex gap-2">
            <Input
              value={publicAddress}
              onChange={(e) => setPublicAddress(e.target.value)}
              placeholder="https://cms-omega-seven.vercel.app"
            />
            <Button loading={savingAddr} onClick={savePublicAddress}>
              Save
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
