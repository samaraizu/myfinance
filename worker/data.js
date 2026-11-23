// アプリのデータを KV に保存して、どのブラウザ・端末でも同じ内容を見られるようにする。APP_KEY を合言葉に使う
const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

export async function handleData(request, env) {
  if (!env.APP_KEY) return json(503, { error: "Add the APP_KEY secret in Cloudflare first." });
  if (request.headers.get("x-app-key") !== env.APP_KEY) return json(401, { error: "App key does not match. Check it in settings." });
  if (request.method === "GET") {
    const saved = await env.MF_KV.get("app_data");
    return saved ? new Response(saved, { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } }) : json(404, { error: "Nothing saved yet" });
  }
  if (request.method === "PUT") {
    const text = await request.text();
    if (text.length > 20_000_000) return json(413, { error: "Data is too large. Remove a few photos." });
    let body; try { body = JSON.parse(text); } catch { return json(400, { error: "Send JSON" }); }
    if (!body || typeof body.updatedAt !== "number" || typeof body.data !== "object") return json(400, { error: "Send {updatedAt, data}" });
    const current = JSON.parse(await env.MF_KV.get("app_data") || "null");
    if (current && current.updatedAt > body.updatedAt) return json(409, current);  // サーバーの方が新しい
    await env.MF_KV.put("app_data", text);
    return json(200, { ok: true, updatedAt: body.updatedAt });
  }
  return json(405, { error: "Use GET or PUT" });
}
