export type WebsiteStatus = "live" | "draft";

export interface Website {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  vercel_project_id: string | null;
  github_repo: string | null;
  deploy_hook_url: string | null;
  status: WebsiteStatus;
  client_password_hash?: string | null;
  /**
   * Set when the site is deleted. The row stays so the Vercel sync keeps
   * recognising the project and does not re-import it — see schema.sql.
   */
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContentSection {
  id: string;
  heading: string;
  body: string;
  image_url?: string | null;
}

export interface Page {
  id: string;
  website_id: string;
  slug: string;
  title: string;
  hero_heading: string | null;
  hero_subheading: string | null;
  hero_image_url: string | null;
  content: ContentSection[];
  seo_title: string | null;
  seo_description: string | null;
  seo_keyphrase?: string | null;
  /** Published text/image overrides for arbitrary elements on a live (non-template) site. */
  content_overrides?: Record<string, string> | null;
  draft?: PageDraft | null;
  updated_at: string;
}

/** Unpublished changes from the visual editor. */
export interface PageDraft {
  title: string;
  hero_heading: string | null;
  hero_subheading: string | null;
  hero_image_url: string | null;
  content: ContentSection[];
  seo_title: string | null;
  seo_description: string | null;
  seo_keyphrase: string | null;
  /** Arbitrary text/image overrides keyed by a stable position-based element id. */
  overrides?: Record<string, string>;
}

export interface PostDraft {
  title: string;
  excerpt: string | null;
  content: string;
  featured_image_url: string | null;
}

export interface BlogPost {
  id: string;
  website_id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  featured_image_url: string | null;
  published: boolean;
  published_at: string | null;
  draft?: PostDraft | null;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  website_id: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  social_links: Record<string, string>;
  updated_at: string;
}

/* ------------------------------------------------------------------ */
/* Leads — prospects surfaced by the Offline Business Finder.          */
/* Written to the `businesses` table by that app; read-only here apart */
/* from the outreach fields an operator edits (status, notes, contact).*/
/* ------------------------------------------------------------------ */

export type LeadStatus = "not_contacted" | "in_outreach" | "closed" | "skipped";

/** Why we believe this business has no site of its own. */
export type WebsiteSignal =
  | "no_website_field"
  | "social_only"
  | "directory_only"
  | "has_website"
  | "unknown";

export interface LeadPhoto {
  url: string;
  caption?: string;
}

export interface LeadSummary {
  text: string;
  pitchAngle?: string;
  sentiment?: string;
  opportunityScore?: number;
  source: string;
  generatedAt: string;
}

export interface Lead {
  id: string;
  external_id: string | null;
  /** "google_places" | "yelp" | "mock" | "manual" — "mock" means synthetic. */
  source: string;
  name: string;
  category: string;
  street: string | null;
  city: string;
  state: string;
  postal_code: string | null;
  phone: string | null;
  contact_name: string | null;
  email: string | null;
  website: string | null;
  website_signal: WebsiteSignal;
  rating: number | string | null;
  review_count: number | null;
  photos: LeadPhoto[];
  summary: LeadSummary | null;
  lead_status: LeadStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
