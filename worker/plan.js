// Notion の予算と Subscriptions を、Claude が KV の "plan" に置く。アプリは合言葉付きで読む
const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
export async function handlePlan(request, env) {
  if (!env.APP_KEY) return json(503, { error: "Add the APP_KEY secret in Cloudflare first." });
  if (request.headers.get("x-app-key") !== env.APP_KEY) return json(401, { error: "App key does not match. Check it in settings." });
  const plan = await env.MF_KV.get("plan");
  return plan ? new Response(plan, { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } }) : json(404, { error: "No plan yet" });
}
