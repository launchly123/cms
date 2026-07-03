"use client";

import * as React from "react";
import { Banner, Button, Card, Field, Input } from "@/app/components/ui";

export function PasswordGate({
  slug,
  siteName,
}: {
  slug: string;
  siteName: string;
}) {
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/client/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data.error === "string" && data.error !== "internal_error"
            ? data.error
            : "Something went wrong. Please try again."
        );
        return;
      }
      window.location.reload();
    } catch {
      setError("Something went wrong. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-foreground text-lg font-bold text-background">
            {siteName.charAt(0).toUpperCase()}
          </div>
          <h1 className="text-lg font-semibold">{siteName}</h1>
          <p className="mt-1 text-sm text-muted">
            Enter your editor password to manage this website&apos;s content.
          </p>
        </div>

        {error && <Banner kind="error">{error}</Banner>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Password">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              required
            />
          </Field>
          <Button type="submit" loading={loading} className="w-full">
            Open editor
          </Button>
        </form>
      </Card>
    </div>
  );
}
