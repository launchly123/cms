"use client";

import * as React from "react";
import type { PageDraft } from "@/lib/types";
import { analyzeSeo, type SeoCheck } from "@/lib/seo";
import { Button } from "@/app/components/ui";

function CheckList({
  title,
  checks,
  dot,
}: {
  title: string;
  checks: SeoCheck[];
  dot: string;
}) {
  if (!checks.length) return null;
  return (
    <div className="mb-5">
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">
        {title}
      </p>
      <ul className="space-y-2">
        {checks.map((c, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot}`} />
            <span className="text-foreground/90">{c.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SeoPanel({
  form,
  pageSlug,
  domain,
  update,
  onSave,
  saving,
  onClose,
}: {
  form: PageDraft;
  pageSlug: string;
  domain: string | null;
  update: (patch: Partial<PageDraft>) => void;
  onSave: () => void;
  saving: boolean;
  onClose: () => void;
}) {
  const analysis = analyzeSeo({
    seoTitle: form.seo_title ?? "",
    seoDescription: form.seo_description ?? "",
    keyphrase: form.seo_keyphrase ?? "",
    slug: pageSlug,
    headings: form.content.map((s) => s.heading),
    paragraphs: [form.hero_subheading ?? "", ...form.content.map((s) => s.body)],
    hasHeroImage: Boolean(form.hero_image_url),
  });

  const displayDomain = domain ?? "yoursite.com";
  const displayUrl =
    pageSlug === "home" ? displayDomain : `${displayDomain} › ${pageSlug}`;
  const titleShown = (form.seo_title ?? "").trim() || form.title || "Untitled page";
  const descShown = (form.seo_description ?? "").trim();

  const gradeDot =
    analysis.grade === "red"
      ? "bg-red-500"
      : analysis.grade === "orange"
        ? "bg-amber-500"
        : "bg-emerald-500";

  const inputCls =
    "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-foreground/30";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 md:p-10">
      <div className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="font-semibold">Search appearance</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted transition-colors hover:bg-card-hover hover:text-foreground"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="grid flex-1 gap-8 overflow-y-auto p-6 md:grid-cols-2">
          {/* Left: Google preview + fields */}
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">
              How this page looks on Google
            </p>
            <div className="rounded-xl bg-white p-4 text-left shadow">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-[10px] font-bold text-gray-600">
                  {displayDomain.charAt(0).toUpperCase()}
                </div>
                <div className="text-xs leading-tight">
                  <div className="text-gray-800">{displayDomain}</div>
                  <div className="text-gray-500">{displayUrl}</div>
                </div>
              </div>
              <div className="mt-1.5 truncate text-xl text-[#1a0dab]">
                {titleShown}
              </div>
              <div className="mt-1 line-clamp-2 text-sm text-gray-600">
                {descShown ||
                  "Add a description so Google shows a helpful summary here under your title — around 155 characters reads best and fills the snippet like this."}
              </div>
            </div>

            <div className="mt-6 space-y-5">
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-sm font-medium">Page title</label>
                  <span
                    className={`text-xs ${(form.seo_title ?? "").length > 60 ? "text-red-400" : "text-emerald-400"}`}
                  >
                    {(form.seo_title ?? "").length}/60
                  </span>
                </div>
                <input
                  className={inputCls}
                  value={form.seo_title ?? ""}
                  onChange={(e) => update({ seo_title: e.target.value })}
                  placeholder={form.title}
                />
                <p className="mt-1 text-xs text-muted">
                  The clickable headline in Google. Keep under 60 characters.
                </p>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-sm font-medium">Description</label>
                  <span
                    className={`text-xs ${(form.seo_description ?? "").length > 160 ? "text-red-400" : "text-emerald-400"}`}
                  >
                    {(form.seo_description ?? "").length}/160
                  </span>
                </div>
                <textarea
                  className={inputCls}
                  rows={3}
                  value={form.seo_description ?? ""}
                  onChange={(e) => update({ seo_description: e.target.value })}
                  placeholder="The grey summary under the title in Google. ~155 characters."
                />
              </div>
            </div>
          </div>

          {/* Right: keyphrase + analysis */}
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">
              SEO analysis
            </p>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm font-medium">Focus keyphrase</label>
              <span className="text-xs text-muted">
                {(form.seo_keyphrase ?? "").length}/60
              </span>
            </div>
            <input
              className={inputCls}
              value={form.seo_keyphrase ?? ""}
              onChange={(e) => update({ seo_keyphrase: e.target.value })}
              placeholder="e.g. italian restaurant cajicá"
            />
            <p className="mt-1 text-xs text-muted">
              The main thing this page should rank for. We score the page
              against it.
            </p>

            <div className="mt-5 mb-6 flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-3">
              <span className={`h-4 w-4 rounded-full ${gradeDot}`} />
              <div>
                <p className="text-sm font-semibold">
                  SEO score: {analysis.label}
                </p>
                <p className="text-xs text-muted">
                  {analysis.passing}/{analysis.total} checks passing
                </p>
              </div>
            </div>

            <CheckList
              title="Problems"
              dot="bg-red-500"
              checks={analysis.checks.filter((c) => c.level === "problem")}
            />
            <CheckList
              title="Improvements"
              dot="bg-amber-500"
              checks={analysis.checks.filter((c) => c.level === "improvement")}
            />
            <CheckList
              title="Good results"
              dot="bg-emerald-500"
              checks={analysis.checks.filter((c) => c.level === "good")}
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <p className="text-xs text-muted">
            SEO changes stage as a draft — use Save here, then Publish from the
            top bar to go live.
          </p>
          <Button loading={saving} onClick={onSave}>
            Save draft
          </Button>
        </div>
      </div>
    </div>
  );
}
