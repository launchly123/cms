-- =============================================================
-- CMS schema — run this in Supabase Dashboard → SQL Editor → Run
-- Safe to re-run (idempotent).
-- =============================================================

create extension if not exists pgcrypto;

create table if not exists public.websites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  domain text,
  vercel_project_id text unique,
  github_repo text,
  deploy_hook_url text,
  status text not null default 'draft' check (status in ('live', 'draft')),
  client_password_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.websites add column if not exists client_password_hash text;

-- Deleting a site has to leave a tombstone behind, not remove the row.
-- The dashboard re-imports every Vercel project it does not already know about
-- on each load, and it recognises a project by vercel_project_id on an existing
-- row. Hard-delete the row and the very next page load imports the site again.
-- Keeping the row (with deleted_at set) is what makes a deletion stick.
alter table public.websites add column if not exists deleted_at timestamptz;

create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites(id) on delete cascade,
  slug text not null,
  title text not null,
  hero_heading text,
  hero_subheading text,
  hero_image_url text,
  content jsonb not null default '[]',
  seo_title text,
  seo_description text,
  updated_at timestamptz not null default now(),
  unique (website_id, slug)
);

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites(id) on delete cascade,
  slug text not null,
  title text not null,
  excerpt text,
  content text not null default '',
  featured_image_url text,
  published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (website_id, slug)
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null unique references public.websites(id) on delete cascade,
  email text,
  phone text,
  address text,
  social_links jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- Visual editor: unpublished draft data + SEO keyphrase
alter table public.pages add column if not exists draft jsonb;
alter table public.pages add column if not exists seo_keyphrase text;
alter table public.blog_posts add column if not exists draft jsonb;
-- Published text/image overrides for arbitrary elements on a live (non-template) site
alter table public.pages add column if not exists content_overrides jsonb;

-- Owner-level app settings (AI provider/key, public client address). Single row.
create table if not exists public.app_settings (
  id int primary key default 1,
  ai_provider text,            -- 'anthropic' | 'openrouter'
  ai_model text,
  ai_api_key text,             -- secret; never returned to the client
  ai_daily_limit int not null default 50,   -- warn/block once this many AI edits are used in a day
  ai_daily_count int not null default 0,
  ai_daily_date date,                        -- date ai_daily_count applies to; resets on a new day
  public_address text,
  updated_at timestamptz not null default now(),
  constraint app_settings_single_row check (id = 1)
);
alter table public.app_settings add column if not exists ai_daily_limit int not null default 50;
alter table public.app_settings add column if not exists ai_daily_count int not null default 0;
alter table public.app_settings add column if not exists ai_daily_date date;
-- Settings are read/written only via the CMS service role — lock out anon.
alter table public.app_settings enable row level security;

create index if not exists blog_posts_website_idx on public.blog_posts (website_id, created_at desc);
create index if not exists pages_website_idx on public.pages (website_id);

-- Row Level Security: the CMS uses the service role key (bypasses RLS).
-- These policies let client websites read content with the public anon key.
alter table public.websites enable row level security;
alter table public.pages enable row level security;
alter table public.blog_posts enable row level security;
alter table public.contacts enable row level security;

drop policy if exists "public read websites" on public.websites;
create policy "public read websites" on public.websites for select using (true);

drop policy if exists "public read pages" on public.pages;
create policy "public read pages" on public.pages for select using (true);

drop policy if exists "public read published posts" on public.blog_posts;
create policy "public read published posts" on public.blog_posts
  for select using (published = true);

drop policy if exists "public read contacts" on public.contacts;
create policy "public read contacts" on public.contacts for select using (true);

-- Public image bucket for uploaded photos.
insert into storage.buckets (id, name, public)
values ('images', 'images', true)
on conflict (id) do nothing;
