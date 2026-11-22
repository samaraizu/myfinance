// freee 会計のカード明細を取ってくる。freee の認証情報は KV（MF_KV）にだけ保存し、スマホには渡さない
// 必要な Secret: FREEE_CLIENT_ID, FREEE_CLIENT_SECRET, APP_KEY（スマホの「App key」と同じ合言葉）
// 必要な変数: FREEE_COMPANY_ID（wrangler.jsonc の vars）
const AUTH = "https://accounts.secure.freee.co.jp/public_api";
const API = "https://api.freee.co.jp/api/1";
const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
const redirectUri = url => `${url.origin}/api/freee/callback`;
const keyOk = (env, key) => !!env.APP_KEY && key === env.APP_KEY;
const setupMissing = env => ["FREEE_CLIENT_ID", "FREEE_CLIENT_SECRET", "APP_KEY"].filter(k => !env[k]);

async function saveTokens(env, t) {
  await env.MF_KV.put("freee_tokens", JSON.stringify({
    access_token: t.access_token, refresh_token: t.refresh_token,
    expires_at: Date.now() + (t.expires_in || 21600) * 1000 - 60_000,
  }));
}
async function tokenRequest(env, params) {
  const r = await fetch(`${AUTH}/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: env.FREEE_CLIENT_ID, client_secret: env.FREEE_CLIENT_SECRET, ...params }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) throw new Error(d.error_description || d.error || `freee token error ${r.status}`);
  return d;
}
async function accessToken(env) {
  const saved = JSON.parse(await env.MF_KV.get("freee_tokens") || "null");
  if (!saved) return null;
  if (Date.now() < saved.expires_at) return saved.access_token;
  // freee のリフレッシュトークンは使うたびに新しくなるので、必ず保存し直す
  const t = await tokenRequest(env, { grant_type: "refresh_token", refresh_token: saved.refresh_token });
  await saveTokens(env, t);
  return t.access_token;
}
async function freeeGet(env, token, path, query) {
  const r = await fetch(`${API}${path}?${new URLSearchParams(query)}`, { headers: { Authorization: `Bearer ${token}` } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d.errors && d.errors[0]?.messages?.join(" ")) || d.message || `freee API error ${r.status}`);
  return d;
}

export async function handleFreee(request, env) {
  const url = new URL(request.url);
  const missing = setupMissing(env);

  // 1) 接続開始: スマホの設定画面から App key 付きで開く → freee のログイン画面へ
  if (url.pathname === "/api/freee/connect") {
    if (missing.length) return new Response(`Set these secrets in Cloudflare first: ${missing.join(", ")}`, { status: 503 });
    if (!keyOk(env, url.searchParams.get("key"))) return new Response("App key does not match. Check it in ••• settings.", { status: 401 });
    const state = crypto.randomUUID();
    await env.MF_KV.put(`state:${state}`, "1", { expirationTtl: 600 });
    const auth = new URL(`${AUTH}/authorize`);
    auth.search = new URLSearchParams({ client_id: env.FREEE_CLIENT_ID, redirect_uri: redirectUri(url), response_type: "code", state }).toString();
    return Response.redirect(auth.toString(), 302);
  }

  // 2) freee から戻ってきたところ: 認証コードをトークンに替えて保存
  if (url.pathname === "/api/freee/callback") {
    const state = url.searchParams.get("state"), code = url.searchParams.get("code");
    if (!state || !(await env.MF_KV.get(`state:${state}`))) return new Response("This connection link has expired. Start again from ••• settings.", { status: 400 });
    await env.MF_KV.delete(`state:${state}`);
    if (!code) return new Response("freee did not return a code. Start again from ••• settings.", { status: 400 });
    try {
      await saveTokens(env, await tokenRequest(env, { grant_type: "authorization_code", code, redirect_uri: redirectUri(url) }));
    } catch (e) {
      return new Response(`freee connection failed: ${e.message}`, { status: 502 });
    }
    return Response.redirect(`${url.origin}/?freee=connected`, 302);
  }

  // 3) 明細: 指定した期間のカード利用（支出）を返す
  if (url.pathname === "/api/freee/txns") {
    if (missing.length) return json(503, { error: `freee is not set up yet. Add ${missing.join(", ")} in Cloudflare.` });
    if (!keyOk(env, request.headers.get("x-app-key"))) return json(401, { error: "App key does not match. Check it in ••• settings." });
    const from = url.searchParams.get("from"), to = url.searchParams.get("to");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from || "") || !/^\d{4}-\d{2}-\d{2}$/.test(to || "")) return json(400, { error: "Send from and to as YYYY-MM-DD" });
    try {
      const token = await accessToken(env);
      if (!token) return json(409, { error: "freee is not connected yet. Tap Connect freee in ••• settings.", needsConnect: true });
      const company_id = env.FREEE_COMPANY_ID;
      const { walletables } = await freeeGet(env, token, "/walletables", { company_id, type: "credit_card" });
      const cards = (walletables || []).filter(w => w.type === "credit_card").map(w => ({ id: w.id, name: w.name, synced: w.update_date }));
      const txns = [];
      for (const c of cards) {
        for (let offset = 0; offset < 1000; offset += 100) {
          const { wallet_txns } = await freeeGet(env, token, "/wallet_txns", { company_id, walletable_type: "credit_card", walletable_id: c.id, start_date: from, end_date: to, limit: 100, offset });
          for (const t of wallet_txns || []) if (t.walletable_id === c.id) txns.push({ id: t.id, card: c.id, date: t.date, description: t.description, amount: t.amount, side: t.entry_side });
          if (!wallet_txns || wallet_txns.length < 100) break;
        }
      }
      // Amazon の注文（品名つき）: カード明細の「アマゾン」を品名で補うために使う。カードの請求は注文の数日〜2週間後になるので20日前から取る
      const wallets = (await freeeGet(env, token, "/walletables", { company_id, type: "wallet" })).walletables || [];
      const amazon = wallets.filter(w => w.type === "wallet" && /amazon|アマゾン/i.test(w.name));
      const since = new Date(new Date(from).getTime() - 20 * 86400000).toISOString().slice(0, 10);
      const orders = [];
      for (const w of amazon) {
        for (let offset = 0; offset < 1000; offset += 100) {
          const { wallet_txns } = await freeeGet(env, token, "/wallet_txns", { company_id, walletable_type: "wallet", walletable_id: w.id, start_date: since, end_date: to, limit: 100, offset });
          for (const t of wallet_txns || []) if (t.walletable_id === w.id && t.entry_side === "expense") orders.push({ id: t.id, date: t.date, description: t.description, amount: t.amount });
          if (!wallet_txns || wallet_txns.length < 100) break;
        }
      }
      return json(200, { cards, txns, orders, fetched_at: new Date().toISOString() });
    } catch (e) {
      if (/invalid_grant|refresh/i.test(e.message)) {
        await env.MF_KV.delete("freee_tokens");
        return json(409, { error: "The freee connection expired. Tap Connect freee in ••• settings.", needsConnect: true });
      }
      return json(502, { error: e.message });
    }
  }
  return json(404, { error: "Not found" });
}
