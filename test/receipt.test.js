const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// GAS と同じく、src の .js を1つのグローバルスコープで読み込む
const ctx = vm.createContext({});
for (const f of ['Config.js', 'Receipt.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8'), ctx, { filename: f });
}
const g = (expr) => vm.runInContext(expr, ctx);
const normalizeReceipt = g('normalizeReceipt_');
const parseGeminiResponse = g('parseGeminiResponse_');
const checkTotals = g('checkTotals_');
const normalizeDate = g('normalizeDate_');
const buildResponseSchema = g('buildResponseSchema_');
const CATEGORIES = g('DEFAULT_CATEGORIES');

const wrap = (obj) => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] }, finishReason: 'STOP' }] });

test('内税レシート: 値引きを差し引いた明細合計が合計と一致', () => {
  const r = normalizeReceipt({
    purchase_date: '2026-10-28',
    store_name: 'マルエツ 新宿店',
    total: 718,
    tax: 53,
    items: [
      { name_raw: 'ギュウコマ', name_normalized: '牛こま切れ肉', quantity: 1, unit_price: 498, amount: 498, discount: 100, category: '肉' },
      { name_raw: 'タマゴ10コ', name_normalized: '卵 10個入り', quantity: 1, amount: 320, discount: 0, category: '乳製品・卵' },
    ],
  }, CATEGORIES, 1);
  assert.equal(r.items[0].amount, 398);
  assert.equal(r.items[0].discount, 100);
  assert.equal(r.itemsSum, 718);
  assert.equal(r.ok, true);
  assert.equal(r.date, '2026-10-28');
});

test('外税レシート: 明細合計＋税が合計と一致すれば OK', () => {
  const r = normalizeReceipt({
    total: 1080, tax: 80,
    items: [{ name_raw: 'A', name_normalized: 'A', quantity: 2, amount: 1000, discount: 0, category: '日用品' }],
  }, CATEGORIES, 1);
  assert.equal(r.ok, true);
  assert.equal(r.items[0].unitPrice, 500);
});

test('合計不一致は要確認フラグ', () => {
  const c = checkTotals(900, 1000, 74, 1);
  assert.equal(c.ok, false);
  assert.equal(c.diff, 100);
});

test('未知カテゴリ・負の値引き・文字列金額を吸収', () => {
  const r = normalizeReceipt({
    total: '¥1,200',
    items: [{ name_raw: 'X', name_normalized: '', quantity: '0', amount: '1,250', discount: -50, category: '謎' }],
  }, CATEGORIES, 1);
  assert.equal(r.items[0].category, 'その他');
  assert.equal(r.items[0].name, 'X');
  assert.equal(r.items[0].quantity, 1);
  assert.equal(r.items[0].amount, 1200);
  assert.equal(r.total, 1200);
  assert.equal(r.ok, true);
  assert.equal(r.store, '不明');
  assert.equal(r.date, null);
});

test('日付の正規化', () => {
  assert.equal(normalizeDate('2026/1/5'), '2026-01-05');
  assert.equal(normalizeDate('2026年10月3日'), '2026-10-03');
  assert.equal(normalizeDate('R8.10.3'), null);
  assert.equal(normalizeDate('2026-13-01'), null);
});

test('Geminiレスポンスのパース', () => {
  const data = parseGeminiResponse(wrap({ items: [], total: 0 }));
  assert.equal(data.items.length, 0);
  const fenced = { candidates: [{ content: { parts: [{ text: '```json\n{"items":[],"total":5}\n```' }] } }] };
  assert.equal(parseGeminiResponse(fenced).total, 5);
  assert.throws(() => parseGeminiResponse({ candidates: [{ content: { parts: [{ text: 'not json' }] } }] }), /パース/);
  assert.throws(() => parseGeminiResponse(wrap({ total: 1 })), /items/);
  assert.throws(() => parseGeminiResponse({ promptFeedback: { blockReason: 'SAFETY' } }), /SAFETY/);
});

test('スキーマのカテゴリ列挙にマスタが入る', () => {
  const schema = buildResponseSchema(['肉', 'その他']);
  assert.deepEqual(Array.from(schema.properties.items.items.properties.category.enum), ['肉', 'その他']);
});

test('リトライ対象ステータスの判定', () => {
  const isRetryable = g('isRetryableStatus_');
  for (const c of [429, 500, 502, 503, 504]) assert.equal(isRetryable(c), true, String(c));
  for (const c of [400, 401, 403, 404]) assert.equal(isRetryable(c), false, String(c));
});

test('時刻の正規化', () => {
  const normalizeTime = g('normalizeTime_');
  assert.equal(normalizeTime('9:05'), '09:05');
  assert.equal(normalizeTime('21時30分'), '21:30');
  assert.equal(normalizeTime('25:00'), null);
  assert.equal(normalizeTime(null), null);
});

test('同一レシート判定', () => {
  const same = g('isSameReceipt_');
  const base = { date: '2026-11-14', store: 'maruetsu 目黒店', total: 5702, time: null };
  // 撮り直し：店舗表記の空白・全角ゆれは吸収
  assert.equal(same(base, { ...base, store: 'ｍａｒｕｅｔｓｕ　目黒店' }), true);
  // 金額・日付が違えば別物
  assert.equal(same(base, { ...base, total: 5703 }), false);
  assert.equal(same(base, { ...base, date: '2026-11-15' }), false);
  // 時刻が両方あれば時刻で判定：同じ店・同じ金額でも時刻が違えば別の買い物
  assert.equal(same({ ...base, time: '10:00' }, { ...base, time: '18:30' }), false);
  assert.equal(same({ ...base, time: '10:00' }, { ...base, store: 'マルエツ目黒店', time: '10:00' }), true);
  // 片方に時刻がなければ店舗で判定
  assert.equal(same({ ...base, time: '10:00' }, { ...base, store: '別の店' }), false);
});
