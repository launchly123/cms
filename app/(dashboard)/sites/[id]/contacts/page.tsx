"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import {
  Banner,
  Button,
  Card,
  Field,
  Input,
  Spinner,
  Textarea,
  useFlash,
} from "@/app/components/ui";
import type { Contact } from "@/lib/types";

type SocialRow = { key: string; value: string };

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

export default function ContactsPage() {
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<React.ReactNode | null>(null);
  const [flash, setFlash] = useFlash();

  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [links, setLinks] = React.useState<SocialRow[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/websites/${id}/contacts`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(friendlyError(data));
          return;
        }
        const contact: Contact | null = data.contact ?? null;
        if (contact) {
          setEmail(contact.email ?? "");
          setPhone(contact.phone ?? "");
          setAddress(contact.address ?? "");
          setLinks(
            Object.entries(contact.social_links ?? {}).map(([key, value]) => ({
              key,
              value,
            }))
          );
        }
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

  function updateLink(index: number, patch: Partial<SocialRow>) {
    setLinks((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeLink(index: number) {
    setLinks((rows) => rows.filter((_, i) => i !== index));
  }

  function addLink() {
    setLinks((rows) => [...rows, { key: "", value: "" }]);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const social_links: Record<string, string> = {};
      for (const row of links) {
        const key = row.key.trim().toLowerCase();
        const value = row.value.trim();
        if (!key || !value) continue;
        social_links[key] = value;
      }
      const res = await fetch(`/api/websites/${id}/contacts`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim() === "" ? null : email.trim(),
          phone: phone.trim() === "" ? null : phone.trim(),
          address: address.trim() === "" ? null : address.trim(),
          social_links,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(friendlyError(data));
        return;
      }
      setFlash("Saved");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
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
    <div className="p-8 max-w-3xl">
      {error && (
        <Banner kind="error" onDismiss={() => setError(null)}>
          {error}
        </Banner>
      )}
      {flash && <Banner kind="success">{flash}</Banner>}

      <Card className="p-5">
        <h2 className="mb-4 text-sm font-semibold">Contact details</h2>
        <div className="space-y-4">
          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="hello@example.com"
            />
          </Field>
          <Field label="Phone">
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 555 000 0000"
            />
          </Field>
          <Field label="Address">
            <Textarea
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main St, Springfield"
            />
          </Field>
        </div>
      </Card>

      <Card className="mt-6 p-5">
        <h2 className="mb-4 text-sm font-semibold">Social links</h2>
        {links.length === 0 && (
          <p className="mb-3 text-sm text-muted">
            No social links yet. Add Instagram, Facebook, LinkedIn or anything else.
          </p>
        )}
        <div className="space-y-3">
          {links.map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-40 shrink-0">
                <Input
                  value={row.key}
                  onChange={(e) => updateLink(i, { key: e.target.value })}
                  placeholder="instagram"
                  aria-label={`Platform ${i + 1}`}
                />
              </div>
              <Input
                value={row.value}
                onChange={(e) => updateLink(i, { value: e.target.value })}
                placeholder="https://instagram.com/yourname"
                aria-label={`URL ${i + 1}`}
              />
              <Button
                type="button"
                variant="ghost"
                className="px-2.5"
                onClick={() => removeLink(i)}
                aria-label={`Remove link ${i + 1}`}
              >
                ✕
              </Button>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <Button type="button" variant="ghost" onClick={addLink}>
            Add link
          </Button>
        </div>
      </Card>

      <div className="mt-6 flex justify-end">
        <Button loading={saving} onClick={save}>
          Save contacts
        </Button>
      </div>
    </div>
  );
}
