import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { handleApiError, isUniqueViolation } from "@/lib/http";
import { slugify } from "@/lib/validation";
import { listVercelProjects } from "@/lib/vercel";

export async function POST() {
  try {
    const projects = await listVercelProjects();
    const supabase = supabaseAdmin();

    const { data: existing, error: existingError } = await supabase
      .from("websites")
      .select("id, vercel_project_id");
    if (existingError) throw existingError;

    const known = new Set(
      (existing ?? [])
        .map((w) => w.vercel_project_id as string | null)
        .filter((v): v is string => Boolean(v))
    );

    let imported = 0;
    for (const project of projects) {
      if (known.has(project.id)) continue;

      const baseRow = {
        name: project.name,
        slug: slugify(project.name),
        domain: `${project.name}.vercel.app`,
        vercel_project_id: project.id,
        status: "draft" as const,
      };

      const { error } = await supabase.from("websites").insert(baseRow);
      if (!error) {
        imported++;
        continue;
      }

      if (isUniqueViolation(error)) {
        // Slug collision — retry once with a suffix derived from the project id.
        const { error: retryError } = await supabase.from("websites").insert({
          ...baseRow,
          slug: `${baseRow.slug}-${project.id.slice(-4)}`,
        });
        if (!retryError) {
          imported++;
        }
        // Ignore remaining per-row failure; continue with other projects.
      }
      // Non-unique-violation per-row failures are also skipped so one bad
      // project doesn't abort the whole sync.
    }

    return NextResponse.json({ imported, total: projects.length });
  } catch (e) {
    return handleApiError(e);
  }
}
