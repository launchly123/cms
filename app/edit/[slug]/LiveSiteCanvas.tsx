"use client";

import * as React from "react";
import type { PageDraft } from "@/lib/types";
import { Spinner } from "@/app/components/ui";

/**
 * Renders the website's ACTUAL live page in an iframe and makes its real
 * hero heading, subheading and photo click-to-edit — not a generic
 * template. Edits flow back up as PageDraft field changes.
 */
export function LiveSiteCanvas({
  slug,
  pageId,
  form,
  update,
  onImageClick,
}: {
  slug: string;
  pageId: string;
  form: PageDraft;
  update: (patch: Partial<PageDraft>) => void;
  onImageClick: () => void;
}) {
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState(false);

  const src = React.useMemo(() => {
    const params = new URLSearchParams({ pageId });
    if (form.hero_heading) params.set("hero_heading", form.hero_heading);
    if (form.hero_subheading) params.set("hero_subheading", form.hero_subheading);
    if (form.hero_image_url) params.set("hero_image_url", form.hero_image_url);
    return `/api/client/sites/${slug}/preview-html?${params.toString()}`;
    // Only reload the iframe when switching pages, not on every keystroke —
    // live edits are applied in-place via postMessage instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, pageId]);

  React.useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (!e.data || e.data.source !== "cms-editor") return;
      if (e.data.type === "edit") {
        update({ [e.data.field]: e.data.value } as Partial<PageDraft>);
      } else if (e.data.type === "select-image") {
        onImageClick();
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [update, onImageClick]);

  // Push a freshly-uploaded hero image into the live iframe without a reload.
  React.useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { source: "cms-editor-parent", type: "set-image", field: "hero_image_url", value: form.hero_image_url },
      "*"
    );
  }, [form.hero_image_url]);

  return (
    <div className="relative min-h-[70vh] bg-white">
      {loading && !failed && (
        <div className="absolute inset-0 flex items-center justify-center bg-white">
          <Spinner className="h-6 w-6 text-gray-400" />
        </div>
      )}
      {failed && (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 p-10 text-center text-gray-500">
          <p className="font-medium text-gray-700">Couldn&apos;t load the live site</p>
          <p className="max-w-sm text-sm">
            The site at this domain didn&apos;t respond. Check the domain in
            Settings, or that the site is deployed.
          </p>
        </div>
      )}
      {!failed && (
        <iframe
          ref={iframeRef}
          key={src}
          src={src}
          title="Live site editor"
          className="h-[calc(100vh-140px)] w-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setFailed(true);
          }}
        />
      )}
    </div>
  );
}
