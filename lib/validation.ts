import { z } from "zod";

const slugRegex = /^[a-z0-9-]+$/;

export const contentSectionSchema = z.object({
  id: z.string().min(1),
  heading: z.string().max(300),
  body: z.string().max(20000),
  image_url: z.string().max(1000).nullable().optional(),
});

export const websiteCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  slug: z
    .string()
    .trim()
    .regex(slugRegex, "Lowercase letters, numbers and dashes only")
    .max(100)
    .optional(),
  domain: z.string().trim().max(200).nullable().optional(),
});

export const websiteUpdateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100).optional(),
  slug: z
    .string()
    .trim()
    .regex(slugRegex, "Lowercase letters, numbers and dashes only")
    .max(100)
    .optional(),
  domain: z.string().trim().max(200).nullable().optional(),
  github_repo: z.string().trim().max(200).nullable().optional(),
  deploy_hook_url: z.string().trim().max(500).nullable().optional(),
  status: z.enum(["live", "draft"]).optional(),
  // Write-only: hashed server-side into client_password_hash. Null clears it.
  client_password: z
    .string()
    .min(6, "Client password must be at least 6 characters")
    .max(100)
    .nullable()
    .optional(),
});

/** Draft payload saved by the visual editor for a page. */
export const pageDraftSchema = z.object({
  title: z.string().trim().min(1).max(200),
  hero_heading: z.string().max(300).nullable(),
  hero_subheading: z.string().max(500).nullable(),
  hero_image_url: z.string().max(1000).nullable(),
  content: z.array(contentSectionSchema).max(50),
  seo_title: z.string().max(200).nullable(),
  seo_description: z.string().max(500).nullable(),
  seo_keyphrase: z.string().max(100).nullable(),
  overrides: z.record(z.string(), z.string().max(20000)).optional(),
});

/** Draft payload saved by the visual editor for a blog post. */
export const postDraftSchema = z.object({
  title: z.string().trim().min(1).max(200),
  excerpt: z.string().max(500).nullable(),
  content: z.string().max(200000),
  featured_image_url: z.string().max(1000).nullable(),
});

export const pageCreateSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  slug: z
    .string()
    .trim()
    .regex(slugRegex, "Lowercase letters, numbers and dashes only")
    .max(100)
    .optional(),
});

export const pageUpdateSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200).optional(),
  slug: z
    .string()
    .trim()
    .regex(slugRegex, "Lowercase letters, numbers and dashes only")
    .max(100)
    .optional(),
  hero_heading: z.string().trim().max(300).nullable().optional(),
  hero_subheading: z.string().trim().max(500).nullable().optional(),
  hero_image_url: z.string().trim().max(1000).nullable().optional(),
  content: z.array(contentSectionSchema).max(50).optional(),
  seo_title: z.string().trim().max(200).nullable().optional(),
  seo_description: z.string().trim().max(500).nullable().optional(),
});

export const blogCreateSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  slug: z
    .string()
    .trim()
    .regex(slugRegex, "Lowercase letters, numbers and dashes only")
    .max(100)
    .optional(),
  excerpt: z.string().trim().max(500).nullable().optional(),
  content: z.string().max(200000).optional(),
  featured_image_url: z.string().trim().max(1000).nullable().optional(),
  published: z.boolean().optional(),
});

export const blogUpdateSchema = blogCreateSchema.partial();

const emptyOrEmail = z
  .string()
  .trim()
  .max(200)
  .refine((v) => v === "" || /^\S+@\S+\.\S+$/.test(v), "Invalid email address");

export const contactSchema = z.object({
  email: emptyOrEmail.nullable().optional(),
  phone: z.string().trim().max(50).nullable().optional(),
  address: z.string().trim().max(500).nullable().optional(),
  social_links: z.record(z.string(), z.string().max(500)).optional(),
});

export type ParsedBody<S extends z.ZodTypeAny> =
  | { data: z.infer<S>; error?: never }
  | { data?: never; error: { message: string; issues: string[] } };

/** Parse and validate a JSON request body against a zod schema. */
export async function parseJson<S extends z.ZodTypeAny>(
  req: Request,
  schema: S
): Promise<ParsedBody<S>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { error: { message: "Invalid JSON body", issues: [] } };
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      error: {
        message: "Validation failed",
        issues: result.error.issues.map(
          (i) => `${i.path.join(".") || "body"}: ${i.message}`
        ),
      },
    };
  }
  return { data: result.data };
}

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "untitled"
  );
}
