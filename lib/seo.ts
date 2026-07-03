/**
 * Yoast-style SEO analysis for a page, matching the editor's
 * Problems / Improvements / Good results panel.
 * Pure functions — safe to run on every keystroke.
 */

export interface SeoInput {
  seoTitle: string;
  seoDescription: string;
  keyphrase: string;
  slug: string;
  headings: string[]; // section headings
  paragraphs: string[]; // hero subheading + section bodies (plain text)
  hasHeroImage: boolean;
}

export type SeoLevel = "problem" | "improvement" | "good";

export interface SeoCheck {
  level: SeoLevel;
  text: string;
}

export interface SeoResult {
  checks: SeoCheck[];
  passing: number;
  total: number;
  /** red | orange | green */
  grade: "red" | "orange" | "green";
  label: string;
}

const has = (haystack: string, needle: string) =>
  haystack.toLowerCase().includes(needle.toLowerCase());

export function analyzeSeo(input: SeoInput): SeoResult {
  const checks: SeoCheck[] = [];
  const kp = input.keyphrase.trim();
  const title = input.seoTitle.trim();
  const desc = input.seoDescription.trim();
  const allText = input.paragraphs.join(" ").trim();
  const wordCount = allText ? allText.split(/\s+/).length : 0;
  const firstParagraph = input.paragraphs.find((p) => p.trim()) ?? "";

  // --- Title ---
  if (!title) {
    checks.push({ level: "problem", text: "Add an SEO title." });
  } else if (title.length < 20) {
    checks.push({
      level: "improvement",
      text: `SEO title is short — aim for 20–60 characters (now ${title.length}).`,
    });
  } else if (title.length > 60) {
    checks.push({
      level: "improvement",
      text: `SEO title is long — Google cuts it off after ~60 characters (now ${title.length}).`,
    });
  } else {
    checks.push({ level: "good", text: "SEO title length is good." });
  }

  // --- Meta description ---
  if (!desc) {
    checks.push({ level: "problem", text: "Add a meta description." });
  } else if (desc.length < 50) {
    checks.push({
      level: "improvement",
      text: `Meta description is short — aim for 50–160 characters (now ${desc.length}).`,
    });
  } else if (desc.length > 160) {
    checks.push({
      level: "improvement",
      text: `Meta description is long — keep it under 160 characters (now ${desc.length}).`,
    });
  } else {
    checks.push({ level: "good", text: "Meta description length is good." });
  }

  // --- Keyphrase checks ---
  if (!kp) {
    checks.push({
      level: "improvement",
      text: "Set a focus keyphrase — the main thing this page should rank for.",
    });
  } else {
    if (title && has(title, kp)) {
      checks.push({ level: "good", text: "Focus keyphrase is in the SEO title." });
    } else {
      checks.push({ level: "problem", text: "Focus keyphrase is not in the SEO title." });
    }

    if (desc && has(desc, kp)) {
      checks.push({ level: "good", text: "Focus keyphrase is in the meta description." });
    } else {
      checks.push({
        level: "improvement",
        text: "Focus keyphrase is not in the meta description.",
      });
    }

    const slugified = kp.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    if (input.slug === "home" || input.slug.includes(slugified)) {
      checks.push({ level: "good", text: "URL slug works for the keyphrase." });
    } else {
      checks.push({ level: "improvement", text: "Focus keyphrase is not in the URL slug." });
    }

    if (input.headings.some((h) => has(h, kp))) {
      checks.push({ level: "good", text: "A subheading uses the focus keyphrase." });
    } else {
      checks.push({
        level: "improvement",
        text: "Use the focus keyphrase in at least one subheading.",
      });
    }

    if (firstParagraph && has(firstParagraph, kp)) {
      checks.push({ level: "good", text: "Focus keyphrase appears early in the content." });
    } else {
      checks.push({
        level: "improvement",
        text: "Use the focus keyphrase in the first paragraph.",
      });
    }

    if (allText) {
      const occurrences = allText.toLowerCase().split(kp.toLowerCase()).length - 1;
      const density = wordCount ? (occurrences / wordCount) * 100 : 0;
      if (occurrences === 0) {
        checks.push({
          level: "improvement",
          text: "Keyphrase density is low (0.0%) — use it a little more.",
        });
      } else {
        checks.push({
          level: "good",
          text: `Keyphrase used ${occurrences}× in the content (${density.toFixed(1)}%).`,
        });
      }
    }
  }

  // --- Content ---
  if (wordCount >= 300) {
    checks.push({ level: "good", text: `Text length: ${wordCount} words — good.` });
  } else if (wordCount >= 100) {
    checks.push({
      level: "improvement",
      text: `Text length: ${wordCount} words — aim for 300+.`,
    });
  } else {
    checks.push({
      level: "improvement",
      text: `Very little text (${wordCount} words) — add more content.`,
    });
  }

  if (input.hasHeroImage) {
    checks.push({ level: "good", text: "The page has a hero image." });
  } else {
    checks.push({ level: "improvement", text: "Add a hero image." });
  }

  if (input.headings.filter((h) => h.trim()).length >= 2) {
    checks.push({ level: "good", text: "The page uses multiple subheadings." });
  }

  const total = checks.length;
  const passing = checks.filter((c) => c.level === "good").length;
  const hasProblems = checks.some((c) => c.level === "problem");
  const ratio = total ? passing / total : 0;
  const grade: SeoResult["grade"] =
    hasProblems || ratio < 0.4 ? "red" : ratio < 0.8 ? "orange" : "green";
  const label =
    grade === "red" ? "Needs work" : grade === "orange" ? "Getting there" : "Good";

  return { checks, passing, total, grade, label };
}
