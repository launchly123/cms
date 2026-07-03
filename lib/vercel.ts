export interface VercelProject {
  id: string;
  name: string;
}

export function vercelConfigured(): boolean {
  return Boolean(process.env.VERCEL_API_TOKEN);
}

/** List all projects on the connected Vercel account (paginated). */
export async function listVercelProjects(): Promise<VercelProject[]> {
  if (!vercelConfigured()) throw new Error("vercel_not_configured");
  const projects: VercelProject[] = [];
  let until: number | undefined;
  // Hard cap of 10 pages (1000 projects) as a safety bound.
  for (let i = 0; i < 10; i++) {
    const url = new URL("https://api.vercel.com/v10/projects");
    url.searchParams.set("limit", "100");
    if (until) url.searchParams.set("until", String(until));
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`vercel_api_error_${res.status}`);
    const data = await res.json();
    for (const p of data.projects ?? []) {
      projects.push({ id: p.id, name: p.name });
    }
    const next = data.pagination?.next;
    if (!next) break;
    until = next;
  }
  return projects;
}

/** Fire a Vercel deploy hook. Returns true if the hook accepted. */
export async function triggerDeployHook(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "POST" });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Best-effort on-demand revalidation of a client website.
 * The site must expose POST /api/revalidate checking REVALIDATE_SECRET.
 */
export async function revalidateSite(domain: string, path = "/"): Promise<boolean> {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return false;
  try {
    const res = await fetch(
      `https://${domain}/api/revalidate?secret=${encodeURIComponent(secret)}&path=${encodeURIComponent(path)}`,
      { method: "POST" }
    );
    return res.ok;
  } catch {
    return false;
  }
}
