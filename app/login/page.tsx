"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Banner, Button, Card, Field, Input } from "@/app/components/ui";

export default function OwnerLoginPage() {
  return (
    <React.Suspense fallback={null}>
      <LoginForm />
    </React.Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/owner/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
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
      const next = searchParams.get("next") || "/";
      router.push(next.startsWith("/") ? next : "/");
      router.refresh();
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
            C
          </div>
          <h1 className="text-lg font-semibold">CMS Dashboard</h1>
          <p className="mt-1 text-sm text-muted">
            Enter your admin password to manage your websites.
          </p>
        </div>

        {error && <Banner kind="error">{error}</Banner>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Admin password">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              required
            />
          </Field>
          <Button type="submit" loading={loading} className="w-full">
            Sign in
          </Button>
        </form>
      </Card>
    </div>
  );
}
