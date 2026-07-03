"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import type { Website } from "@/lib/types";
import { Badge, Banner } from "@/app/components/ui";

const TABS = [
  { label: "Pages", segment: "pages" },
  { label: "Blog", segment: "blog" },
  { label: "Contacts", segment: "contacts" },
  { label: "Settings", segment: "settings" },
] as const;

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const [website, setWebsite] = React.useState<Website | null>(null);
  const [notFound, setNotFound] = React.useState(false);

  React.useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/websites/${id}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          if (res.status === 404) setNotFound(true);
          return;
        }
        setNotFound(false);
        setWebsite(data.website as Website);
      } catch {
        // keep whatever we had; child pages surface their own errors
      }
    })();
    return () => {
      cancelled = true;
    };
    // Re-fetch when the pathname changes so the header picks up renames etc.
  }, [id, pathname]);

  if (notFound) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <Banner kind="error">
          This website was not found.{" "}
          <Link href="/" className="underline hover:opacity-80">
            Back to Websites
          </Link>
        </Banner>
      </div>
    );
  }

  return (
    <div>
      <div className="border-b border-border px-8 py-5">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/"
            className="text-muted text-sm hover:text-foreground transition-colors"
          >
            ← Websites
          </Link>
          <h1 className="text-lg font-semibold">{website ? website.name : "…"}</h1>
          {website?.domain && (
            <a
              href={`https://${website.domain}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-muted hover:text-foreground transition-colors"
            >
              {website.domain} ↗
            </a>
          )}
          {website &&
            (website.status === "live" ? (
              <Badge color="green">Live</Badge>
            ) : (
              <Badge color="gray">Draft</Badge>
            ))}
          {website && (
            <Link
              href={`/edit/${website.slug}`}
              className="ml-auto inline-flex h-8 items-center rounded-md bg-foreground px-3 text-sm font-medium text-background transition-opacity hover:opacity-85"
            >
              Open editor ✏️
            </Link>
          )}
        </div>
      </div>

      <nav className="px-8 border-b border-border flex gap-1" aria-label="Site sections">
        {TABS.map((tab) => {
          const href = `/sites/${id}/${tab.segment}`;
          const active = pathname.startsWith(href);
          return (
            <Link
              key={tab.segment}
              href={href}
              className={`px-3 py-2.5 text-sm border-b-2 -mb-px transition-colors ${
                active
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
