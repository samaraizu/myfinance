// myfinance: app/ の静的ファイル（worker/static.js に同梱）を配信する。レシートの読み取りはスマホから Google Cloud Vision を直接呼ぶ
import { FILES } from "./static.js";
import { handleFreee } from "./freee.js";

const SECURITY = {
  "X-Robots-Tag": "noindex",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};
const decoded = new Map();
const bytesOf = path => {
  if (!decoded.has(path)) decoded.set(path, Uint8Array.from(atob(FILES[path].b64), c => c.charCodeAt(0)));
  return decoded.get(path);
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let res;
    if (url.pathname.startsWith("/api/freee/")) {
      res = await handleFreee(request, env);
      if (res.status >= 300 && res.status < 400) return res;  // リダイレクトはそのまま返す
    } else if (request.method !== "GET" && request.method !== "HEAD") {
      res = new Response("Method not allowed", { status: 405 });
    } else {
      const path = url.pathname === "/" ? "/index.html" : url.pathname;
      const file = FILES[path] ? path : (path.includes(".") ? null : "/index.html");
      res = file
        ? new Response(request.method === "HEAD" ? null : bytesOf(file), { headers: { "Content-Type": FILES[file].type, "Cache-Control": file === "/sw.js" || file === "/index.html" || file.endsWith(".webmanifest") || file.includes("apple-touch") ? "no-cache" : "public, max-age=3600" } })
        : new Response("Not found", { status: 404 });
    }
    res = new Response(res.body, res);
    for (const [k, v] of Object.entries(SECURITY)) res.headers.set(k, v);
    return res;
  },
};
