/**
 * スプレッドシートの読み書き。
 */
function openSpreadsheet_() {
  return SpreadsheetApp.openById(getProp_(PROP.SPREADSHEET_ID, true));
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

function toSheetDate_(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d);
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
    receipt.itemsSum, receipt.diff, receipt.ok ? 'OK' : '要確認', new Date(), fileUrl,
  ]);
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
      new Date(), level, file ? file.getName() : '', file ? file.getId() : '', String(message).slice(0, 1000),
    ]);
  } catch (e) {
    console.error(`ログ書き込み失敗: ${e}`);
  }
  (level === 'ERROR' ? console.error : console.log)(`[${level}] ${message}`);
}
