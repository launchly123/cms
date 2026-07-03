"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Website } from "@/lib/types";
import {
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Spinner,
  useFlash,
} from "@/app/components/ui";

const SUPABASE_MSG =
  "Supabase isn't connected yet — add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local and run supabase/schema.sql (see the Websites page for full steps).";
const VERCEL_MSG = "Add your VERCEL_API_TOKEN to .env.local to sync from Vercel.";

function friendlyError(data: { error?: string; details?: unknown }): React.ReactNode {
  if (data.error === "supabase_not_configured") return SUPABASE_MSG;
  if (data.error === "vercel_not_configured") return VERCEL_MSG;
  if (
    Array.isArray(data.details) &&
    data.details.every((d): d is string => typeof d === "string") &&
    data.details.length > 0
  ) {
    return (
      <div>
        <p>{typeof data.error === "string" ? data.error : "Please fix the following:"}</p>
        <ul className="mt-1 list-disc pl-5">
          {data.details.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      </div>
    );
  }
  return "Something went wrong. Please try again.";
}

function EnvName({ children }: { children: React.ReactNode }) {
  return (
    <code className="font-mono text-xs bg-card-hover px-1 py-0.5 rounded">{children}</code>
  );
}

export default function WebsitesPage() {
  const router = useRouter();
  const [websites, setWebsites] = React.useState<Website[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [needsSetup, setNeedsSetup] = React.useState(false);
  const [error, setError] = React.useState<React.ReactNode | null>(null);
  const [flash, setFlash] = useFlash();

  const [syncing, setSyncing] = React.useState(false);
  const [showCreate, setShowCreate] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [name, setName] = React.useState("");
  const [domain, setDomain] = React.useState("");

  const loadWebsites = React.useCallback(async (): Promise<boolean> => {
    const res = await fetch("/api/websites");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 503 && data.error === "supabase_not_configured") {
        setNeedsSetup(true);
      } else {
        setError(friendlyError(data));
      }
      return false;
    }
    setNeedsSetup(false);
    setWebsites(Array.isArray(data.websites) ? data.websites : []);
    return true;
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      // Auto-import from Vercel first; silently ignore any failure.
      let imported = 0;
      try {
        const res = await fetch("/api/websites/sync", { method: "POST" });
        const data = await res.json().catch(() => ({}));
        if (res.ok && typeof data.imported === "number") imported = data.imported;
      } catch {
        // ignore
      }
      if (cancelled) return;
      await loadWebsites();
      if (cancelled) return;
      if (imported > 0) {
        setFlash(`Imported ${imported} website(s) from Vercel`);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadWebsites, setFlash]);

  async function handleSync() {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/websites/sync", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(friendlyError(data));
        return;
      }
      const imported = typeof data.imported === "number" ? data.imported : 0;
      await loadWebsites();
      setFlash(`Synced — ${imported} new website(s)`);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const body: { name: string; domain?: string } = { name: name.trim() };
      if (domain.trim()) body.domain = domain.trim();
      const res = await fetch("/api/websites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(friendlyError(data));
        return;
      }
      setWebsites((prev) => [data.website as Website, ...prev]);
      setName("");
      setDomain("");
      setShowCreate(false);
      setFlash("Website created");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <PageHeader
        title="Websites"
        description="Every site you manage. New Vercel projects appear here automatically."
        actions={
          <>
            <Button variant="ghost" loading={syncing} onClick={handleSync}>
              Sync from Vercel
            </Button>
            <Button onClick={() => setShowCreate((v) => !v)}>Add website</Button>
          </>
        }
      />

      {flash && <Banner kind="success">{flash}</Banner>}
      {error && (
        <Banner kind="error" onDismiss={() => setError(null)}>
          {error}
        </Banner>
      )}

      {showCreate && (
        <Card className="mb-6 p-6">
          <form onSubmit={handleCreate} className="space-y-4">
            <Field label="Name">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Client Site"
                required
                autoFocus
              />
            </Field>
            <Field label="Domain (optional)">
              <Input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="mysite.com"
              />
            </Field>
            <div className="flex items-center gap-2">
              <Button type="submit" loading={creating}>
                Create
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowCreate(false);
                  setName("");
                  setDomain("");
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-24">
          <Spinner className="h-6 w-6" />
        </div>
      ) : needsSetup ? (
        <Card className="p-6">
          <h2 className="font-semibold">Finish connecting Supabase</h2>
          <p className="mt-1 text-sm text-muted">
            Your content database isn&apos;t hooked up yet. It only takes a couple of
            minutes:
          </p>
          <ol className="mt-4 list-decimal space-y-2.5 pl-5 text-sm text-foreground">
            <li>
              Open{" "}
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-foreground"
              >
                supabase.com/dashboard
              </a>{" "}
              → your project → Settings → API.
            </li>
            <li>
              Copy &quot;Project URL&quot; and the &quot;service_role&quot; key.
            </li>
            <li>
              Paste them into <EnvName>.env.local</EnvName> as{" "}
              <EnvName>SUPABASE_URL</EnvName> and{" "}
              <EnvName>SUPABASE_SERVICE_ROLE_KEY</EnvName>.
            </li>
            <li>
              In Supabase open SQL Editor, paste the contents of{" "}
              <EnvName>supabase/schema.sql</EnvName> from this project, click Run.
            </li>
            <li>Restart the dev server and refresh this page.</li>
          </ol>
        </Card>
      ) : websites.length === 0 ? (
        <EmptyState
          title="No websites yet"
          description="Click Sync from Vercel to import your projects, or add one manually."
          action={<Button onClick={() => setShowCreate(true)}>Add website</Button>}
        />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted border-b border-border">
                <th className="py-3 px-4 font-medium">Website</th>
                <th className="py-3 px-4 font-medium">Domain</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium">Updated</th>
                <th className="py-3 px-4" />
              </tr>
            </thead>
            <tbody>
              {websites.map((site) => (
                <tr
                  key={site.id}
                  className="border-b border-border/60 hover:bg-card-hover transition-colors cursor-pointer"
                  onClick={() => router.push(`/sites/${site.id}`)}
                >
                  <td className="py-3 px-4">
                    <div className="font-semibold">{site.name}</div>
                    <div className="text-muted text-xs">{site.slug}</div>
                  </td>
                  <td className="py-3 px-4">
                    {site.domain ? (
                      <a
                        href={`https://${site.domain}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-muted hover:text-foreground transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {site.domain}
                      </a>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {site.status === "live" ? (
                      <Badge color="green">Live</Badge>
                    ) : (
                      <Badge color="gray">Draft</Badge>
                    )}
                  </td>
                  <td className="py-3 px-4 text-muted">
                    {new Date(site.updated_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Link
                      href={`/sites/${site.id}`}
                      className="inline-flex items-center justify-center rounded-md border border-border px-3 h-8 text-sm text-foreground hover:bg-card-hover transition-colors"
                    >
                      Manage →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
