import { apiError, handleApiError } from "@/lib/http";
import { getEditorAccess } from "@/lib/clientAccess";

function htmlResponse(body: string) {
  return new Response(body, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/** A friendly in-iframe message so the editor shows something instead of hanging. */
function errorPage(message: string) {
  return htmlResponse(
    `<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;color:#666;text-align:center;padding:2rem;background:#fff"><div><p style="font-weight:600;color:#333;margin:0 0 6px">Couldn't load the live site</p><p style="font-size:14px;max-width:22rem;margin:0">${message}</p></div></body></html>`
  );
}

/**
 * Fetches the real live page for a website and returns it with an "editing
 * bridge" script injected. The bridge makes EVERY text element and image on
 * the page click-to-edit (keyed by document position), applies saved overrides,
 * and re-applies them if the site re-renders itself (e.g. a language toggle).
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

    const target = `https://${website.domain}`;

    // Fetch the live site with a hard timeout so a slow/cold site can't hang
    // the editor forever — show a friendly message instead.
    let html: string;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(target, {
        cache: "no-store",
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 (CMS editor preview)" },
      });
      if (!res.ok) {
        return errorPage(
          `The site returned an error (${res.status}). Check that ${website.domain} is deployed and reachable.`
        );
      }
      html = await res.text();
    } catch {
      return errorPage(
        `${website.domain} didn't respond in time. It may be waking up — wait a moment and reopen the editor.`
      );
    } finally {
      clearTimeout(timeout);
    }

    const bridge = `
<style>
  [data-cms-editing="true"]{outline:2px solid transparent;transition:outline-color .15s;}
  [data-cms-editing="true"]:hover{outline:2px dashed rgba(56,189,248,.7);outline-offset:2px;cursor:text;}
  [data-cms-editing="true"]:focus{outline:2px solid #0ea5e9;outline-offset:2px;}
  img[data-cms-editing="true"]:hover{outline:2px dashed rgba(56,189,248,.9);cursor:pointer;}
</style>
<script>
(function () {
  var overrides = {};
  var SKIP = "header,nav,a,button,script,style,svg,select,textarea,input,form,iframe";

  function isTextLeaf(el) {
    if (el.childElementCount !== 0) return false;
    if (!(el.textContent || "").trim()) return false;
    if (el.closest(SKIP)) return false;
    return /^(H1|H2|H3|H4|H5|H6|P|LI|BLOCKQUOTE|FIGCAPTION|TD|TH|SPAN|DIV|LABEL|EM|STRONG|SMALL|B|I)$/.test(el.tagName);
  }

  function send(type, field, value) {
    parent.postMessage({ source: "cms-editor", type: type, field: field, value: value }, "*");
  }

  var mo;
  function tag() {
    if (mo) mo.disconnect();
    var all = document.body.getElementsByTagName("*");
    var ti = 0, ii = 0;
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.tagName === "IMG") {
        if (el.closest("header,nav")) continue;
        var ik = "i" + (ii++);
        el.setAttribute("data-cms-key", ik);
        if (overrides[ik]) el.src = overrides[ik];
        el.setAttribute("data-cms-editing", "true");
        (function (node, key) {
          node.onclick = function (ev) { ev.preventDefault(); ev.stopPropagation(); send("select-image", key, node.src); };
        })(el, ik);
      } else if (isTextLeaf(el)) {
        var tk = "t" + (ti++);
        el.setAttribute("data-cms-key", tk);
        if (overrides[tk] != null) el.textContent = overrides[tk];
        el.setAttribute("contenteditable", "true");
        el.setAttribute("data-cms-editing", "true");
        el.setAttribute("spellcheck", "false");
        (function (node, key) {
          node.oninput = function () { send("edit", key, node.textContent); };
          node.onkeydown = function (ev) {
            if (ev.key === "Enter" && node.tagName !== "DIV" && node.tagName !== "LI") { ev.preventDefault(); node.blur(); }
          };
        })(el, tk);
      }
    }
    if (mo) mo.observe(document.body, { childList: true, subtree: true });
  }

  window.addEventListener("message", function (e) {
    if (!e.data || e.data.source !== "cms-editor-parent") return;
    if (e.data.type === "apply-overrides") { overrides = e.data.overrides || {}; tag(); }
    else if (e.data.type === "set-image") {
      overrides[e.data.field] = e.data.value;
      var el = document.querySelector('[data-cms-key="' + e.data.field + '"]');
      if (el) el.src = e.data.value;
    }
  });

  var reapply;
  mo = new MutationObserver(function () {
    var a = document.activeElement;
    if (a && a.getAttribute && a.getAttribute("data-cms-editing") === "true") return;
    clearTimeout(reapply); reapply = setTimeout(tag, 120);
  });

  function boot() { tag(); parent.postMessage({ source: "cms-editor", type: "ready" }, "*"); }
  setTimeout(boot, 80);
  window.addEventListener("load", boot);
})();
</script>
</body>`;

    // <base> must land in <head>, before any relative resource is parsed.
    const baseTag = `<base href="${target}/">`;
    const withBase = /<head[^>]*>/i.test(html)
      ? html.replace(/<head[^>]*>/i, (m) => `${m}${baseTag}`)
      : baseTag + html;

    const injected = withBase.includes("</body>")
      ? withBase.replace("</body>", bridge)
      : withBase + bridge;

    return htmlResponse(injected);
  } catch (e) {
    return handleApiError(e);
  }
}
