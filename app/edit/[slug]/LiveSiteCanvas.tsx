"use client";

import * as React from "react";
import type { PageDraft } from "@/lib/types";
import { Spinner } from "@/app/components/ui";

/**
 * Renders the website's ACTUAL live page in an iframe and makes EVERY text
 * element and image on it click-to-edit. Edits are stored as position-keyed
 * overrides on the page draft (form.overrides). Images are replaced by
 * uploading through the client upload endpoint.
 */
export function LiveSiteCanvas({
  slug,
  pageId,
  form,
  update,
}: {
  slug: string;
  pageId: string;
  form: PageDraft;
  update: (patch: Partial<PageDraft>) => void;
}) {
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [loading, setLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);

  // Keep the latest overrides in a ref so message handlers never go stale.
  const overridesRef = React.useRef<Record<string, string>>(form.overrides ?? {});
  overridesRef.current = form.overrides ?? {};

  // Which image key is being replaced (set when the user clicks an image).
  const pendingImageKey = React.useRef<string | null>(null);

  const src = React.useMemo(
    () => `/api/client/sites/${slug}/preview-html?pageId=${encodeURIComponent(pageId)}`,
    [slug, pageId]
  );

  const postToIframe = React.useCallback((message: unknown) => {
    iframeRef.current?.contentWindow?.postMessage(message, "*");
  }, []);

  const setOverride = React.useCallback(
    (key: string, value: string) => {
      const next = { ...overridesRef.current, [key]: value };
      overridesRef.current = next;
      update({ overrides: next });
    },
    [update]
  );

  React.useEffect(() => {
    function onMessage(e: MessageEvent) {
      const data = e.data;
      if (!data || data.source !== "cms-editor") return;
      if (data.type === "ready") {
        postToIframe({
          source: "cms-editor-parent",
          type: "apply-overrides",
          overrides: overridesRef.current,
        });
      } else if (data.type === "edit") {
        setOverride(data.field, data.value);
      } else if (data.type === "select-image") {
        pendingImageKey.current = data.field;
        fileRef.current?.click();
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [postToIframe, setOverride]);

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    const key = pendingImageKey.current;
    if (!file || !key) return;
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/client/sites/${slug}/upload`, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (res.ok && typeof data.url === "string") {
        setOverride(key, data.url);
        postToIframe({ source: "cms-editor-parent", type: "set-image", field: key, value: data.url });
      }
    } finally {
      setUploading(false);
      pendingImageKey.current = null;
    }
  }

  return (
    <div className="relative min-h-[70vh] bg-white">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white">
          <Spinner className="h-6 w-6 text-gray-400" />
        </div>
      )}
      {uploading && (
        <div className="absolute right-3 top-3 z-10 flex items-center gap-2 rounded-md bg-black/80 px-3 py-1.5 text-xs text-white">
          <Spinner className="h-3.5 w-3.5" /> Uploading image…
        </div>
      )}
      <iframe
        ref={iframeRef}
        key={src}
        src={src}
        title="Live site editor"
        className="h-[calc(100vh-140px)] w-full border-0"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        onLoad={() => setLoading(false)}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileChosen}
      />
    </div>
  );
}
