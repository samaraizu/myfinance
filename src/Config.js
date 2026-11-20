/**
 * 設定値と定数。秘密情報はここに書かず、スクリプトプロパティで管理する。
 */
const CONFIG = {
  DEFAULT_MODEL: 'gemini-3.8-flash',
  MAX_FILES_PER_RUN: 5, // 無料枠のレート制限対策
  INTERVAL_MS: 4000, // 連続処理時のAPI呼び出し間隔
  RETRY_WAITS_MS: [5000, 15000, 30000], // 混雑時のリトライ間隔（回数＝要素数）
  TOTAL_TOLERANCE: 1, // 明細合計とレシート合計の許容誤差（円）
  TRIGGER_MINUTES: 10,
  SUPPORTED_MIME: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'],
  SPREADSHEET_ID: '1iXfZPggxoxpQIiP6MJUKbHF62628p-poP-nuuYCGbiA', // 記録先（Finance-1.0）
};

const FOLDER = {
  INBOX: 'receipts_inbox',
  DONE: 'receipts_done',
  ERROR: 'receipts_error',
};

const PROP = {
  API_KEY: 'GEMINI_API_KEY',
  MODEL: 'GEMINI_MODEL',
  SPREADSHEET_ID: 'SPREADSHEET_ID', // 旧「レシート記録」。移行元としてだけ使う
  MIGRATED_TO: 'POS_MIGRATED_TO',
  INBOX_ID: 'INBOX_FOLDER_ID',
  DONE_ID: 'DONE_FOLDER_ID',
  ERROR_ID: 'ERROR_FOLDER_ID',
};

// 統合先の既存シートと区別するため【POS】を付ける
const LEGACY_SHEET = {
  ITEMS: '明細',
  RECEIPTS: 'レシート',
  CATEGORIES: 'カテゴリマスタ',
  DASHBOARD: 'ダッシュボード',
  LOG: 'ログ',
};
const SHEET = Object.fromEntries(Object.entries(LEGACY_SHEET).map(([k, v]) => [k, `【POS】${v}`]));

const HEADERS = {
  ITEMS: ['日付', '店舗', '品名', '正規化品名', 'カテゴリ', '数量', '単価', '金額', '値引き', 'レシートID', '画像リンク'],
  RECEIPTS: ['ID', '日付', '店舗', '合計', '税額', '明細合計', '差額', 'チェック', '処理日時', '画像リンク'],
  CATEGORIES: ['カテゴリ', '月予算'],
  LOG: ['日時', 'レベル', 'ファイル名', 'ファイルID', 'メッセージ'],
};

const DEFAULT_CATEGORIES = [
  '野菜・果物', '肉', '魚', '乳製品・卵', '主食（米・パン・麺）', '調味料',
  '惣菜・弁当', 'お菓子・デザート', '飲料', '酒', '日用品', 'その他',
];

const FALLBACK_CATEGORY = 'その他';

function getProp_(key, required) {
  const value = PropertiesService.getScriptProperties().getProperty(key);
  if (required && !value) {
    throw new Error(`スクリプトプロパティ ${key} が未設定です。README のセットアップ手順を確認してください。`);
  }
  return value;
}

function setProp_(key, value) {
  PropertiesService.getScriptProperties().setProperty(key, value);
}
