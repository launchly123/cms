import { getEditorAccess } from "@/lib/clientAccess";
import { supabaseConfigured } from "@/lib/supabase";
import { PasswordGate } from "./PasswordGate";
import { Editor } from "./Editor";

export const dynamic = "force-dynamic";

export default async function EditPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (!supabaseConfigured()) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <p className="max-w-md text-center text-sm text-muted">
          The CMS isn&apos;t connected to Supabase yet. The site owner needs to
          finish setup first.
        </p>
      </div>
    );
  }

  const result = await getEditorAccess(slug);

  if (!result.ok && result.reason === "not_found") {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <p className="text-sm text-muted">
          No website found at this link. Double-check the address.
        </p>
      </div>
    );
  }

  if (!result.ok) {
    return <PasswordGate slug={slug} siteName={result.website?.name ?? slug} />;
  }

  return <Editor slug={slug} role={result.access.role} />;
}
