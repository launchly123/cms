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
