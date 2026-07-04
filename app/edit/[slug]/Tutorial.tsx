"use client";

import * as React from "react";
import { Button } from "@/app/components/ui";

const STEPS = [
  {
    title: "Welcome to your website editor",
    body: "This is where you update your website's content — no coding needed. Let's walk through the basics in a few quick steps.",
  },
  {
    title: "Click anything to edit it",
    body: "The page in the middle is your real website. Click any headline or paragraph and start typing — it works just like a text document. Click a photo to replace it.",
  },
  {
    title: "Switch pages or add a new one",
    body: "Use the dropdown at the top to jump between pages or blog articles. The “+ Page” and “+ Article” buttons let you create new ones.",
  },
  {
    title: "Preview on phone, tablet, or computer",
    body: "Use the Desktop / Tablet / Phone buttons at the top to see how your changes look on different screens before you publish.",
  },
  {
    title: "Check your SEO",
    body: "The “SEO” button shows how your page will look in Google search results, plus tips to help it rank better.",
  },
  {
    title: "Save vs. Publish — this is important",
    body: "“Save” keeps your changes as a draft — only you can see them. “Publish” makes them go live on the real website immediately. Always double check, then hit Publish when you're happy.",
  },
];

const STORAGE_PREFIX = "cms_tutorial_seen_";

export function useTutorial(websiteId: string | null) {
  const [open, setOpen] = React.useState(false);
  const [checked, setChecked] = React.useState(false);

  React.useEffect(() => {
    if (!websiteId || checked) return;
    setChecked(true);
    try {
      const seen = window.localStorage.getItem(STORAGE_PREFIX + websiteId);
      if (!seen) setOpen(true);
    } catch {
      // localStorage unavailable — just skip auto-show
    }
  }, [websiteId, checked]);

  const dismiss = React.useCallback(() => {
    setOpen(false);
    if (websiteId) {
      try {
        window.localStorage.setItem(STORAGE_PREFIX + websiteId, "1");
      } catch {
        /* ignore */
      }
    }
  }, [websiteId]);

  const reopen = React.useCallback(() => setOpen(true), []);

  return { open, dismiss, reopen };
}

export function Tutorial({ onClose }: { onClose: () => void }) {
  const [step, setStep] = React.useState(0);
  const last = step === STEPS.length - 1;
  const current = STEPS[step];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
        <div className="mb-4 flex gap-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i <= step ? "bg-foreground" : "bg-border"
              }`}
            />
          ))}
        </div>

        <h2 className="mb-2 text-lg font-semibold">{current.title}</h2>
        <p className="mb-6 text-sm leading-relaxed text-muted">{current.body}</p>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted transition-colors hover:text-foreground"
          >
            Skip
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            )}
            <Button
              onClick={() => {
                if (last) onClose();
                else setStep((s) => s + 1);
              }}
            >
              {last ? "Got it — let's start" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
