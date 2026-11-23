// Google カレンダーの「dis」予定の日付を返す。KV の dis_dates（Claude が書き込む）と、
// GCAL_ICS_URL（カレンダーの「iCal 形式の非公開URL」）の両方を合わせる
const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
const DIS = /^\s*dis(\b|\s*[|｜])/i;

function datesFromIcs(text) {
  const lines = text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  const out = new Set(); let ev = null;
  for (const l of lines) {
    if (l === "BEGIN:VEVENT") ev = {};
    else if (l === "END:VEVENT") { if (ev && ev.date && DIS.test(ev.summary || "") && ev.status !== "CANCELLED") out.add(ev.date); ev = null; }
    else if (ev) {
      const i = l.indexOf(":"); if (i < 0) continue;
      const k = l.slice(0, i), v = l.slice(i + 1);
      if (k.startsWith("SUMMARY")) ev.summary = v.replace(/\\,/g, ",");
      else if (k === "STATUS") ev.status = v;
      else if (k.startsWith("DTSTART")) {
        const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/); if (!m) continue;
        if (m[7]) { const d = new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5]) + 9 * 3600e3); ev.date = d.toISOString().slice(0, 10); }
        else ev.date = `${m[1]}-${m[2]}-${m[3]}`;
      }
    }
  }
  return out;
}

export async function handleCal(request, env) {
  if (!env.APP_KEY) return json(503, { error: "Add the APP_KEY secret in Cloudflare first." });
  if (request.headers.get("x-app-key") !== env.APP_KEY) return json(401, { error: "App key does not match. Check it in settings." });
  const dates = new Set(JSON.parse(await env.MF_KV.get("dis_dates") || "[]"));
  let ics = false;
  if (env.GCAL_ICS_URL) {
    try { const r = await fetch(env.GCAL_ICS_URL); if (r.ok) { for (const d of datesFromIcs(await r.text())) dates.add(d); ics = true; } } catch {}
  }
  return json(200, { dates: [...dates].sort(), ics });
}
