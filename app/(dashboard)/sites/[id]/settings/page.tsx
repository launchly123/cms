"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Badge,
  Banner,
  Button,
  Card,
  Field,
  Input,
  Spinner,
  useFlash,
} from "@/app/components/ui";
import type { Website } from "@/lib/types";

function friendlyError(data: { error?: string; details?: unknown }): React.ReactNode {
  if (data.error === "supabase_not_configured") {
    return "Supabase isn't connected yet — add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local and run supabase/schema.sql (see the Websites page for full steps).";
  }
  if (data.error === "vercel_not_configured") {
    return "Add your VERCEL_API_TOKEN to .env.local to sync from Vercel.";
  }
  if (Array.isArray(data.details) && data.details.every((d) => typeof d === "string")) {
    return (
      <ul className="list-disc pl-4">
        {(data.details as string[]).map((d, i) => (
          <li key={i}>{d}</li>
        ))}
      </ul>
    );
  }
  return "Something went wrong. Please try again.";
}

export default function SettingsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [error, setError] = React.useState<React.ReactNode | null>(null);
  const [flash, setFlash] = useFlash();

  const [website, setWebsite] = React.useState<Website | null>(null);
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [domain, setDomain] = React.useState("");
  const [githubRepo, setGithubRepo] = React.useState("");
  const [deployHookUrl, setDeployHookUrl] = React.useState("");
  const [clientPassword, setClientPassword] = React.useState("");
  const [savingPassword, setSavingPassword] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/websites/${id}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(friendlyError(data));
          return;
        }
        const site: Website = data.website;
        setWebsite(site);
        setName(site.name ?? "");
        setSlug(site.slug ?? "");
        setDomain(site.domain ?? "");
        setGithubRepo(site.github_repo ?? "");
        setDeployHookUrl(site.deploy_hook_url ?? "");
      } catch {
        if (!cancelled) setError("Something went wrong. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/websites/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          domain: domain.trim() === "" ? null : domain.trim(),
          github_repo: githubRepo.trim() === "" ? null : githubRepo.trim(),
          deploy_hook_url: deployHookUrl.trim() === "" ? null : deployHookUrl.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(friendlyError(data));
        return;
      }
      setWebsite(data.website);
      setFlash("Saved");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function publish(action: "publish" | "unpublish") {
    if (action === "unpublish" && !window.confirm("Unpublish this site and mark it as a draft?")) {
      return;
    }
    setPublishing(true);
    setError(null);
    try {
      const res = await fetch(`/api/websites/${id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(friendlyError(data));
        return;
      }
      setWebsite(data.website);
      if (action === "publish") {
        let msg = "Site published";
        if (data.deployed) msg += " — rebuild triggered";
        if (data.revalidated) msg += " — cache refreshed";
        setFlash(msg);
      } else {
        setFlash("Site unpublished");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPublishing(false);
    }
  }

  async function saveClientPassword() {
    setSavingPassword(true);
    setError(null);
    try {
      const res = await fetch(`/api/websites/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_password: clientPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(friendlyError(data));
        return;
      }
      setWebsite(data.website);
      setClientPassword("");
      setFlash("Client password set — you can send them the editor link now");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSavingPassword(false);
    }
  }

  async function remove() {
    const siteName = website?.name ?? "this website";
    if (
      !window.confirm(
        `Delete "${siteName}"? This removes all of its pages, posts and contact info. This cannot be undone.`
      )
    ) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/websites/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(friendlyError(data));
        setDeleting(false);
        return;
      }
      router.push("/");
    } catch {
      setError("Something went wrong. Please try again.");
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl space-y-6">
      {error && (
        <Banner kind="error" onDismiss={() => setError(null)}>
          {error}
        </Banner>
      )}
      {flash && <Banner kind="success">{flash}</Banner>}

      <Card className="p-5">
        <h2 className="mb-4 text-sm font-semibold">General</h2>
        <div className="space-y-4">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Slug" hint="Used by your website code to load the right content">
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
          </Field>
          <Field label="Domain" hint="Without https://">
            <Input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="mysite.com"
            />
          </Field>
          <Field label="GitHub repo (optional)">
            <Input
              value={githubRepo}
              onChange={(e) => setGithubRepo(e.target.value)}
              placeholder="username/repo"
            />
          </Field>
          <Field
            label="Deploy hook URL (optional)"
            hint="From Vercel: Project → Settings → Git → Deploy Hooks. Publishing will trigger this to rebuild the site."
          >
            <Input
              value={deployHookUrl}
              onChange={(e) => setDeployHookUrl(e.target.value)}
            />
          </Field>
          <div className="flex justify-end">
            <Button loading={saving} onClick={save}>
              Save changes
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 text-sm font-semibold">Publishing</h2>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-2">
              <Badge color={website?.status === "live" ? "green" : "gray"}>
                {website?.status === "live" ? "Live" : "Draft"}
              </Badge>
            </div>
            <p className="text-sm text-muted">
              Live sites show their content publicly. Unpublishing marks the site as a
              draft.
            </p>
          </div>
          {website?.status === "draft" ? (
            <Button loading={publishing} onClick={() => publish("publish")}>
              Publish site
            </Button>
          ) : (
            <Button
              variant="ghost"
              loading={publishing}
              onClick={() => publish("unpublish")}
            >
              Unpublish
            </Button>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-1 text-sm font-semibold">Client access</h2>
        <p className="mb-4 text-sm text-muted">
          Give your client the editor link below plus a password. They can edit
          and publish this site&apos;s content — nothing else.
        </p>
        <div className="space-y-4">
          <Field label="Editor link">
            <div className="flex gap-2">
              <Input
                readOnly
                value={
                  typeof window !== "undefined"
                    ? `${window.location.origin}/edit/${website?.slug ?? slug}`
                    : `/edit/${website?.slug ?? slug}`
                }
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `${window.location.origin}/edit/${website?.slug ?? slug}`
                  );
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? "Copied ✓" : "Copy"}
              </Button>
            </div>
          </Field>
          <Field
            label={
              website?.client_password_hash
                ? "Change client password"
                : "Set client password"
            }
            hint={
              website?.client_password_hash
                ? "A password is already set. Enter a new one to replace it."
                : "At least 6 characters. Your client uses this to open the editor."
            }
          >
            <div className="flex gap-2">
              <Input
                type="text"
                value={clientPassword}
                onChange={(e) => setClientPassword(e.target.value)}
                placeholder="e.g. demiguel2026"
              />
              <Button
                type="button"
                loading={savingPassword}
                disabled={clientPassword.length < 6}
                onClick={saveClientPassword}
              >
                Save
              </Button>
            </div>
          </Field>
        </div>
      </Card>

      <Card className="p-5 border-red-900/50">
        <h2 className="mb-4 text-sm font-semibold">Danger zone</h2>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-muted">
            Deleting a website removes all of its pages, posts and contact info. This
            cannot be undone.
          </p>
          <Button variant="danger" loading={deleting} onClick={remove}>
            Delete this website
          </Button>
        </div>
      </Card>
    </div>
  );
}
