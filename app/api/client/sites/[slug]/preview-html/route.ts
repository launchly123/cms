import { apiError, handleApiError } from "@/lib/http";
import { getEditorAccess } from "@/lib/clientAccess";

/**
 * Fetches the real live page for a website and returns it with a small
 * "editing bridge" script injected. That script finds the hero headline,
 * hero subheading and hero photo in the ACTUAL rendered page (not a
 * generic template) and makes them click-to-edit, resilient to the site
 * re-rendering itself (e.g. a language toggle) via a MutationObserver.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await ctx.params;
    const result = await getEditorAccess(slug);
    if (!result.ok) {
      return apiError(result.reason === "not_found" ? 404 : 401, result.reason);
    }
    const { website } = result.access;
    if (!website.domain) {
      return apiError(400, "no_domain");
    }

    const url = new URL(req.url);
    const pageId = url.searchParams.get("pageId") ?? "";
    const heroHeading = url.searchParams.get("hero_heading") ?? "";
    const heroSubheading = url.searchParams.get("hero_subheading") ?? "";
    const heroImageUrl = url.searchParams.get("hero_image_url") ?? "";

    const target = `https://${website.domain}`;
    let html: string;
    try {
      const res = await fetch(target, { cache: "no-store" });
      if (!res.ok) return apiError(502, "site_unreachable");
      html = await res.text();
    } catch {
      return apiError(502, "site_unreachable");
    }

    const overrides = JSON.stringify({
      pageId,
      hero_heading: heroHeading || null,
      hero_subheading: heroSubheading || null,
      hero_image_url: heroImageUrl || null,
    }).replace(/</g, "\\u003c");

    const bridge = `
<style>
  [data-cms-editing="true"] { outline: 2px solid transparent; cursor: text; transition: outline-color .15s; }
  [data-cms-editing="true"]:hover { outline-color: rgba(56,189,248,.6); }
  [data-cms-editing="true"]:focus { outline: 2px solid #0ea5e9; outline-offset: 1px; }
  img[data-cms-editing="true"] { cursor: pointer; }
</style>
<script>
(function () {
  var OVERRIDES = ${overrides};
  var applied = false;

  function firstVisible(list) {
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      var r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return el;
    }
    return null;
  }

  function findHeroParts() {
    var h1 = firstVisible(document.querySelectorAll("h1"));
    if (!h1) return null;
    // First substantial paragraph-like text after the h1, within the same section.
    var section = h1.closest("section") || h1.parentElement;
    var sub = null;
    if (section) {
      var candidates = section.querySelectorAll("p");
      for (var i = 0; i < candidates.length; i++) {
        var t = (candidates[i].textContent || "").trim();
        if (t.length > 0) { sub = candidates[i]; break; }
      }
    }
    // Largest image within the hero section (by rendered area).
    var img = null, best = 0;
    var scope = section || document;
    var imgs = scope.querySelectorAll("img");
    for (var j = 0; j < imgs.length; j++) {
      var r = imgs[j].getBoundingClientRect();
      var area = r.width * r.height;
      if (area > best) { best = area; img = imgs[j]; }
    }
    return { h1: h1, sub: sub, img: img };
  }

  function applyOverrides(parts) {
    if (OVERRIDES.hero_heading && parts.h1) parts.h1.textContent = OVERRIDES.hero_heading;
    if (OVERRIDES.hero_subheading && parts.sub) parts.sub.textContent = OVERRIDES.hero_subheading;
    if (OVERRIDES.hero_image_url && parts.img) parts.img.src = OVERRIDES.hero_image_url;
  }

  function bind() {
    var parts = findHeroParts();
    if (!parts || !parts.h1) return;
    applyOverrides(parts);

    parts.h1.setAttribute("contenteditable", "true");
    parts.h1.setAttribute("data-cms-editing", "true");
    parts.h1.oninput = function () {
      parent.postMessage({ source: "cms-editor", type: "edit", field: "hero_heading", value: parts.h1.textContent }, "*");
    };

    if (parts.sub) {
      parts.sub.setAttribute("contenteditable", "true");
      parts.sub.setAttribute("data-cms-editing", "true");
      parts.sub.oninput = function () {
        parent.postMessage({ source: "cms-editor", type: "edit", field: "hero_subheading", value: parts.sub.textContent }, "*");
      };
    }

    if (parts.img) {
      parts.img.setAttribute("data-cms-editing", "true");
      parts.img.onclick = function (e) {
        e.preventDefault();
        parent.postMessage({ source: "cms-editor", type: "select-image", field: "hero_image_url" }, "*");
      };
    }

    applied = true;
  }

  window.addEventListener("message", function (e) {
    if (!e.data || e.data.source !== "cms-editor-parent") return;
    if (e.data.type === "set-image" && e.data.field === "hero_image_url") {
      OVERRIDES.hero_image_url = e.data.value;
      var parts = findHeroParts();
      if (parts && parts.img) parts.img.src = e.data.value;
    }
  });

  // The real site may re-render itself (e.g. a language toggle) — watch
  // for that and reapply our edits + bindings so they aren't lost.
  var mo = new MutationObserver(function () {
    if (document.activeElement && document.activeElement.hasAttribute("data-cms-editing")) return;
    bind();
  });
  mo.observe(document.body, { childList: true, subtree: true });

  setTimeout(bind, 50);
  window.addEventListener("load", bind);
})();
</script>
</body>`;

    // <base> must land in <head>, before any relative resource is parsed,
    // so relative asset URLs resolve against the real site, not our origin.
    const baseTag = `<base href="${target}/">`;
    const withBase = /<head[^>]*>/i.test(html)
      ? html.replace(/<head[^>]*>/i, (m) => `${m}${baseTag}`)
      : baseTag + html;

    const injected = withBase.includes("</body>")
      ? withBase.replace("</body>", bridge)
      : withBase + bridge;

    return new Response(injected, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
