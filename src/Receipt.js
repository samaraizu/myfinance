/**
 * レシートデータの純粋ロジック（GASサービスに依存しない）。
 * Node のテストからも読み込めるよう、Apps Script API は使わない。
 */

function buildPrompt_(categories) {
  return [
    'あなたは日本のレシートを読み取るアシスタントです。画像のレシートから購入情報を抽出し、指定のJSONスキーマで返してください。',
    '',
    'ルール:',
    '- purchase_date は YYYY-MM-DD 形式。和暦や2桁年は西暦に直す。読めなければ null。',
    '- store_name は店舗名（チェーン名＋支店名があれば両方）。',
    '- items には商品行のみを入れる。小計・合計・税・お預り・お釣り・ポイント・支払方法の行は含めない。',
    '- name_raw はレシートの表記そのまま。name_normalized は一般的な日本語の商品名に直す（例: ギュウコマ → 牛こま切れ肉、Gオレンジ100 → オレンジジュース）。',
    '- quantity は個数（記載がなければ 1）。unit_price は単価（記載がなければ amount / quantity）。',
    '- amount は値引き前の行金額。',
    '- 「値引」「割引」「半額」などの行は独立した品目にせず、直前の該当品目の discount に正の数で入れる。値引きがなければ 0。',
    `- category は次から必ず1つ選ぶ: ${categories.join(' / ')}`,
    '- total はレシートの合計（支払総額）。tax は消費税額（内税・外税どちらでも記載の税額、なければ null）。',
    '- 金額はすべて円の数値（カンマや記号なし）。',
  ].join('\n');
}

function buildResponseSchema_(categories) {
  return {
    type: 'OBJECT',
    properties: {
      purchase_date: { type: 'STRING', nullable: true },
      store_name: { type: 'STRING', nullable: true },
      items: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            name_raw: { type: 'STRING' },
            name_normalized: { type: 'STRING' },
            quantity: { type: 'NUMBER' },
            unit_price: { type: 'NUMBER', nullable: true },
            amount: { type: 'NUMBER' },
            discount: { type: 'NUMBER' },
            category: { type: 'STRING', enum: categories },
          },
          required: ['name_raw', 'name_normalized', 'quantity', 'amount', 'discount', 'category'],
        },
      },
      total: { type: 'NUMBER' },
      tax: { type: 'NUMBER', nullable: true },
    },
    required: ['items', 'total'],
  };
}

/** Gemini の generateContent レスポンスからJSON本体を取り出す。失敗時は例外。 */
function parseGeminiResponse_(response) {
  const candidate = response && response.candidates && response.candidates[0];
  if (!candidate) {
    const reason = response && response.promptFeedback && response.promptFeedback.blockReason;
    throw new Error(`Geminiから候補が返りませんでした${reason ? `（${reason}）` : ''}`);
  }
  const parts = (candidate.content && candidate.content.parts) || [];
  const text = parts.map((p) => p.text || '').join('').trim();
  if (!text) throw new Error(`Geminiの応答が空です（finishReason: ${candidate.finishReason}）`);
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
  let data;
  try {
    data = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`GeminiのJSONをパースできません: ${cleaned.slice(0, 200)}`);
  }
  if (!data || !Array.isArray(data.items)) throw new Error('JSONに items 配列がありません');
  if (typeof toNumber_(data.total) !== 'number') throw new Error('JSONに total がありません');
  return data;
}

/** 混雑・一時障害など、時間を置けば通る可能性があるステータスか。 */
function isRetryableStatus_(code) {
  return code === 429 || code === 500 || code === 502 || code === 503 || code === 504;
}

function toNumber_(value) {
  if (typeof value === 'number' && isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value.replace(/[,，¥￥円\s]/g, ''));
    if (value.trim() !== '' && isFinite(n)) return n;
  }
  return null;
}

function normalizeDate_(value) {
  if (!value) return null;
  const m = String(value).match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Gemini の生データを検証・整形し、明細合計チェックまで済ませる。 */
function normalizeReceipt_(raw, categories, tolerance) {
  const allowed = new Set(categories);
  const items = raw.items
    .map((it) => {
      const quantity = toNumber_(it.quantity) || 1;
      const amount = Math.round(toNumber_(it.amount) || 0);
      const discount = Math.abs(Math.round(toNumber_(it.discount) || 0));
      const unitPrice = toNumber_(it.unit_price);
      const nameRaw = String(it.name_raw || '').trim();
      return {
        nameRaw,
        name: String(it.name_normalized || '').trim() || nameRaw,
        category: allowed.has(it.category) ? it.category : FALLBACK_CATEGORY,
        quantity,
        unitPrice: unitPrice !== null ? Math.round(unitPrice) : Math.round(amount / quantity),
        discount,
        amount: amount - discount, // 値引き後の金額
      };
    })
    .filter((it) => it.nameRaw || it.amount !== 0);

  const total = Math.round(toNumber_(raw.total) || 0);
  const taxValue = toNumber_(raw.tax);
  const tax = taxValue !== null ? Math.round(taxValue) : null;
  const itemsSum = items.reduce((sum, it) => sum + it.amount, 0);
  const check = checkTotals_(itemsSum, total, tax, tolerance);

  return {
    date: normalizeDate_(raw.purchase_date),
    store: String(raw.store_name || '').trim() || '不明',
    total,
    tax,
    items,
    itemsSum,
    diff: check.diff,
    ok: check.ok,
  };
}

/**
 * 内税なら 明細合計 = 合計、外税なら 明細合計 + 税 = 合計 になるはず。
 * どちらかが許容誤差内なら OK とする。diff は「合計 − 明細合計（外税一致時は税込）」。
 */
function checkTotals_(itemsSum, total, tax, tolerance) {
  const tol = tolerance == null ? 1 : tolerance;
  const inclusiveDiff = total - itemsSum;
  if (Math.abs(inclusiveDiff) <= tol) return { ok: true, diff: inclusiveDiff };
  if (tax) {
    const exclusiveDiff = total - (itemsSum + tax);
    if (Math.abs(exclusiveDiff) <= tol) return { ok: true, diff: exclusiveDiff };
  }
  return { ok: false, diff: inclusiveDiff };
}
