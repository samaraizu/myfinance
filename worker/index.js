// myfinance: app/ の静的ファイルを配信し、/api/receipt だけ Worker で処理する
import { readReceipt } from "./receipt.js";

const SECURITY = {
  "X-Robots-Tag": "noindex",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let res = url.pathname === "/api/receipt" ? await readReceipt(request, env) : await env.ASSETS.fetch(request);
    res = new Response(res.body, res);
    for (const [k, v] of Object.entries(SECURITY)) res.headers.set(k, v);
    if (url.pathname === "/sw.js") res.headers.set("Cache-Control", "no-cache");
    return res;
  },
};
