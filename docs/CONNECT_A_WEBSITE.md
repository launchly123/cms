# Connect a website to the CMS

This guide is for the agency owner (or a developer) wiring a client's Next.js site up to
the CMS so that content edited in the dashboard shows up on the live site.

## How it works

- **All content lives in Supabase.** The CMS dashboard writes to four tables:
  `websites`, `pages`, `blog_posts`, and `contacts`. Each client site reads its own rows
  back out of the same Supabase project.
- **Sites are identified by slug.** Every website has a unique `slug` (visible in the
  site's Settings page). The client site looks up its `websites` row by that slug, then
  loads pages, posts, and contact info scoped to that website's `id`.
- **Images come from Supabase Storage.** Uploads in the CMS go to the public `images`
  bucket, so `image_url` / `featured_image_url` fields are plain public URLs — render
  them with a normal `<img>` tag.
- **Publishing can refresh the live site two ways:**
  1. **Deploy hook** — publishing in the CMS calls the site's Vercel deploy hook, which
     triggers a full rebuild (best for statically generated sites).
  2. **On-demand revalidation** — the CMS calls the site's `/api/revalidate` endpoint so
     Next.js drops its cached pages instantly, no rebuild needed.

You can use either or both. Revalidation gives near-instant updates; the deploy hook is
the safe fallback for fully static output.

## Environment variables for the client site

Add these to the client site's `.env.local` (and to its Vercel project settings):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
REVALIDATE_SECRET=some-long-random-string
```

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Supabase:
  Project Settings → API. **The anon key is safe to expose** in client-side code:
  Row Level Security only allows reading published content, never writing.
- `REVALIDATE_SECRET` — any long random string, but it must be **the same value the CMS
  uses**, otherwise the CMS's revalidation calls will be rejected.

## Reading content

Create a Supabase client once and reuse it. For example `lib/cms.ts`:

```ts
// lib/cms.ts
import { createClient } from "@supabase/supabase-js";

export const cms = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// The slug of THIS website, as shown in the CMS Settings page.
export const SITE_SLUG = "my-client-site";

export async function getWebsiteId(): Promise<string> {
  const { data, error } = await cms
    .from("websites")
    .select("id")
    .eq("slug", SITE_SLUG)
    .single();
  if (error || !data) throw new Error("Website not found in CMS: " + SITE_SLUG);
  return data.id;
}
```

### Fetch a page (hero, content sections, SEO)

Pages have `title`, `hero_heading`, `hero_subheading`, `hero_image_url`, a `content`
array of sections (`{ id, heading, body, image_url }`), plus `seo_title` and
`seo_description`.

```tsx
// app/[slug]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cms, getWebsiteId } from "@/lib/cms";

type ContentSection = {
  id: string;
  heading: string;
  body: string;
  image_url?: string | null;
};

async function getPage(slug: string) {
  const websiteId = await getWebsiteId();
  const { data } = await cms
    .from("pages")
    .select("*")
    .eq("website_id", websiteId)
    .eq("slug", slug)
    .single();
  return data;
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  const page = await getPage(slug);
  if (!page) return {};
  return {
    title: page.seo_title ?? page.title,
    description: page.seo_description ?? undefined,
  };
}

export default async function Page(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const page = await getPage(slug);
  if (!page) notFound();

  return (
    <main>
      <section>
        <h1>{page.hero_heading ?? page.title}</h1>
        {page.hero_subheading && <p>{page.hero_subheading}</p>}
        {page.hero_image_url && <img src={page.hero_image_url} alt="" />}
      </section>

      {(page.content as ContentSection[]).map((section) => (
        <section key={section.id}>
          <h2>{section.heading}</h2>
          <p>{section.body}</p>
          {section.image_url && <img src={section.image_url} alt={section.heading} />}
        </section>
      ))}
    </main>
  );
}
```

### Fetch published blog posts

Only show posts where `published = true`, newest first:

```ts
// List for /blog
const websiteId = await getWebsiteId();
const { data: posts } = await cms
  .from("blog_posts")
  .select("slug, title, excerpt, featured_image_url, published_at")
  .eq("website_id", websiteId)
  .eq("published", true)
  .order("published_at", { ascending: false });
```

```ts
// Single post for /blog/[slug]
const { data: post } = await cms
  .from("blog_posts")
  .select("*")
  .eq("website_id", websiteId)
  .eq("slug", slug)
  .eq("published", true)
  .single();
```

**Post content is HTML** produced by the CMS's rich-text editor. Render it inside a
styled article:

```tsx
<article
  className="prose"
  dangerouslySetInnerHTML={{ __html: post.content }}
/>
```

(The HTML comes from your own CMS editor, so this is your own trusted content — but keep
the anon key read-only and RLS enabled so nobody else can write to it.)

### Fetch contact info

One `contacts` row per website (may not exist yet):

```ts
const websiteId = await getWebsiteId();
const { data: contact } = await cms
  .from("contacts")
  .select("*")
  .eq("website_id", websiteId)
  .maybeSingle();

// contact?.email, contact?.phone, contact?.address
// contact?.social_links is a Record<string, string>, e.g. { instagram: "https://..." }
```

```tsx
{contact?.social_links &&
  Object.entries(contact.social_links).map(([platform, url]) => (
    <a key={platform} href={url} target="_blank" rel="noreferrer">
      {platform}
    </a>
  ))}
```

## Instant updates (on-demand revalidation)

Add this route to the client site. When content is published in the CMS, it calls
`https://your-site.com/api/revalidate?secret=...&path=/about` and the cached page is
regenerated on the next request — no redeploy.

```ts
// app/api/revalidate/route.ts
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  if (searchParams.get("secret") !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: "invalid_secret" }, { status: 401 });
  }

  const path = searchParams.get("path") || "/";
  revalidatePath(path);

  return NextResponse.json({ revalidated: true, path, now: Date.now() });
}
```

Notes:

- Set `REVALIDATE_SECRET` on both the client site and the CMS to the same value.
- The CMS uses the site's **Domain** field (Settings → General) to know where to send
  the revalidation call, so make sure it's filled in (without `https://`).

## Deploy hook option (full rebuild)

If the site is fully static (or you just want a belt-and-braces rebuild on publish):

1. In Vercel, open the client site's project → **Settings → Git → Deploy Hooks**.
2. Create a hook (name it e.g. `cms-publish`, pick the production branch) and copy the
   generated URL.
3. In the CMS, open the site → **Settings → General**, paste the URL into
   **Deploy hook URL** and save.

Now clicking **Publish site** in the CMS triggers a fresh Vercel build.

## Checklist

1. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
   `REVALIDATE_SECRET` to the client site's environment (locally and on Vercel).
2. Set `SITE_SLUG` in the site's code to match the slug in the CMS Settings page.
3. Add the data-fetching code (pages, blog, contacts) and the
   `app/api/revalidate/route.ts` endpoint.
4. In the CMS Settings page, fill in the site's **Domain** and (optionally) a Vercel
   **Deploy hook URL**.
5. Publish the site in the CMS and confirm the content appears on the live site.
