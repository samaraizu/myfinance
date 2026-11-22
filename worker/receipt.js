// レシート写真を Claude で読み取り、店名・日付・合計・支払い方法・品目を JSON で返す
// 必要な Secret（Cloudflare: Workers → myfinance → Settings → Variables and Secrets）:
//   ANTHROPIC_API_KEY  … Claude API キー（必須）
//   APP_KEY            … 任意。設定するとアプリ側の「Reading key」と一致するときだけ読み取る
import Anthropic from "@anthropic-ai/sdk";

const CATEGORIES = ["Food", "Gadgets", "Clothing", "Household", "Transport", "Cafe", "Hobbies", "Books", "Subscriptions", "Other"];
const MEDIA = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["store", "date", "total", "payment", "card_last4", "items"],
  properties: {
    store: { type: "string", description: "Store name as printed, short. Romanize nothing; keep Japanese as is." },
    date: { type: "string", description: "Purchase date as YYYY-MM-DD, or empty string if not printed." },
    total: { type: "integer", description: "Amount actually paid in yen, tax included." },
    payment: { type: "string", enum: ["cash", "card", "unknown"] },
    card_last4: { type: "string", description: "Last 4 digits of the card if printed, else empty string." },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "amount", "category"],
        properties: {
          name: { type: "string" },
          amount: { type: "integer", description: "Yen for this line after its discounts, tax included." },
          category: { type: "string", enum: CATEGORIES },
        },
      },
    },
  },
};

const INSTRUCTIONS = `Read this receipt (usually Japanese) and fill in the fields.
- total is what was paid, tax included. Ignore change given back and points.
- One item per purchased line. Apply line discounts to that line.
- Make the item amounts add up exactly to total: spread consumption tax across the lines it applies to, or, if that is unclear, add one line "Tax and adjustments" in category Other for the difference.
- Pick each item's category from the list by what the item is. Food is groceries and meals; Cafe is coffee and drinks bought to have there; Household is daily goods.
- If the image is not a receipt or is unreadable, return store "", total 0 and no items.`;

const json = (status, data) => new Response(JSON.stringify(data), {status, headers: {"Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store"}});

export async function readReceipt(request, env) {
  if (request.method !== "POST") return json(405, { error: "Use POST" });
  if (!env.ANTHROPIC_API_KEY) return json(503, { error: "Receipt reading is not set up yet. Add the ANTHROPIC_API_KEY secret in Cloudflare." });
  if (env.APP_KEY && request.headers.get("x-app-key") !== env.APP_KEY) return json(401, { error: "Reading key does not match. Check it in ••• settings." });

  const body = await request.json().catch(() => ({}));
  const { image, mediaType } = body;
  if (typeof image !== "string" || !image || !MEDIA.includes(mediaType)) return json(400, { error: "Send a JPEG, PNG, WebP or GIF image" });
  if (image.length > 4_000_000) return json(413, { error: "Photo is too large. Try again with a smaller photo." });

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
          { type: "text", text: INSTRUCTIONS },
        ],
      }],
    });
    if (response.stop_reason === "refusal") return json(422, { error: "This photo could not be read. Enter the details by hand." });
    if (response.stop_reason === "max_tokens") return json(422, { error: "The receipt was too long to read. Enter the details by hand." });
    const text = response.content.filter(b => b.type === "text").map(b => b.text).join("");
    const data = JSON.parse(text);
    data.items = (data.items || []).filter(i => Number.isInteger(i.amount) && i.amount > 0).map(i => ({ ...i, category: CATEGORIES.includes(i.category) ? i.category : "Other" }));
    return json(200, data);
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return json(502, { error: "The Claude API key in Cloudflare is not valid." });
    if (error instanceof Anthropic.RateLimitError) return json(429, { error: "Too many readings right now. Try again in a minute." });
    if (error instanceof Anthropic.BadRequestError) return json(400, { error: "Claude could not take this photo. Try a JPEG or PNG." });
    if (error instanceof Anthropic.APIError) return json(502, { error: `Claude returned an error (${error.status}). Try again.` });
    if (error instanceof SyntaxError) return json(502, { error: "The reading came back incomplete. Try again." });
    return json(500, { error: "Reading failed. Try again." });
  }
}
