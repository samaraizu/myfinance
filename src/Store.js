/**
 * スプレッドシートの読み書き。
 */
/** 記録先を開く。【POS】シートがまだなければ作成し、旧シートからデータを移す（呼び出し側でロックを取る）。 */
function openSpreadsheet_() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  if (!ss.getSheetByName(SHEET.DASHBOARD)) {
    setupSheets_(ss);
    migrateLegacy_(ss);
    buildDashboard_(ss);
  }
  return ss;
}

function getSheet_(ss, name) {
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error(`シート「${name}」がありません。setup() を実行してください。`);
  return sheet;
}

function getCategories_(ss) {
  const sheet = getSheet_(ss, SHEET.CATEGORIES);
  const last = sheet.getLastRow();
  const list = last < 2 ? [] : sheet.getRange(2, 1, last - 1, 1).getValues()
    .map((r) => String(r[0]).trim())
    .filter(Boolean);
  if (!list.includes(FALLBACK_CATEGORY)) list.push(FALLBACK_CATEGORY);
  return list;
}

function isProcessed_(ss, fileId) {
  const sheet = getSheet_(ss, SHEET.RECEIPTS);
  const last = sheet.getLastRow();
  if (last < 2) return false;
  return sheet.getRange(2, 1, last - 1, 1).createTextFinder(fileId).matchEntireCell(true).findNext() !== null;
}

/**
 * 日付はDateではなく文字列で書く。記録先のタイムゾーンが日本時間でなくても日付がずれないように、
 * 入力したのと同じ扱いでシート側に解釈させる。
 */
function toSheetDate_(isoDate) {
  return isoDate.replace(/-/g, '/');
}

function toSheetDateTime_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy/MM/dd HH:mm:ss');
}

function saveReceipt_(ss, fileId, fileUrl, receipt) {
  const date = toSheetDate_(receipt.date);
  const itemRows = receipt.items.map((it) => [
    date, receipt.store, it.nameRaw, it.name, it.category,
    it.quantity, it.unitPrice, it.amount, it.discount, fileId, fileUrl,
  ]);
  if (itemRows.length) {
    const items = getSheet_(ss, SHEET.ITEMS);
    items.getRange(items.getLastRow() + 1, 1, itemRows.length, HEADERS.ITEMS.length).setValues(itemRows);
  }
  const receipts = getSheet_(ss, SHEET.RECEIPTS);
  receipts.appendRow([
    fileId, date, receipt.store, receipt.total, receipt.tax === null ? '' : receipt.tax,
    receipt.itemsSum, receipt.diff, receipt.ok ? 'OK' : '要確認', toSheetDateTime_(new Date()), fileUrl,
    receipt.time ? `'${receipt.time}` : '', // 先頭の ' で文字列として保存（時刻値に変換させない）
  ]);
}

/** 記録済みのレシートに同じものがあればそのIDを返す。 */
function findDuplicateReceipt_(ss, receipt) {
  const sheet = getSheet_(ss, SHEET.RECEIPTS);
  const last = sheet.getLastRow();
  if (last < 2) return null;
  const tz = ss.getSpreadsheetTimeZone();
  const rows = sheet.getRange(2, 1, last - 1, HEADERS.RECEIPTS.length).getValues();
  const hit = rows.find((r) => isSameReceipt_(receipt, {
    date: r[1] instanceof Date ? Utilities.formatDate(r[1], tz, 'yyyy-MM-dd') : String(r[1]).replace(/\//g, '-'),
    store: r[2],
    total: r[3],
    time: normalizeTime_(r[10]),
  }));
  return hit ? hit[0] : null;
}

/** 当月の支出合計（レシート合計ベース＝実際の支払額）。 */
function getMonthTotal_(ss, baseDate) {
  const now = baseDate || new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const sheet = getSheet_(ss, SHEET.RECEIPTS);
  const last = sheet.getLastRow();
  if (last < 2) return 0;
  return sheet.getRange(2, 2, last - 1, 3).getValues().reduce((sum, [d, , total]) => {
    return d instanceof Date && d >= start && d < end ? sum + (Number(total) || 0) : sum;
  }, 0);
}

function log_(level, file, message) {
  try {
    const ss = openSpreadsheet_();
    getSheet_(ss, SHEET.LOG).appendRow([
      toSheetDateTime_(new Date()), level, file ? file.getName() : '', file ? file.getId() : '', String(message).slice(0, 1000),
    ]);
  } catch (e) {
    console.error(`ログ書き込み失敗: ${e}`);
  }
  (level === 'ERROR' ? console.error : console.log)(`[${level}] ${message}`);
}
