/**
 * 初期セットアップ。エディタから setup() を1回実行する。
 * 何度実行しても既存のフォルダ・シート・データは壊さない。
 */
function setup() {
  getProp_(PROP.API_KEY, true);

  setProp_(PROP.INBOX_ID, ensureFolder_(PROP.INBOX_ID, FOLDER.INBOX).getId());
  setProp_(PROP.DONE_ID, ensureFolder_(PROP.DONE_ID, FOLDER.DONE).getId());
  setProp_(PROP.ERROR_ID, ensureFolder_(PROP.ERROR_ID, FOLDER.ERROR).getId());

  const ss = openSpreadsheet_(); // 【POS】シートがなければ作成・旧シートから移行
  setupSheets_(ss);
  installTrigger_();

  console.log(`スプレッドシート: ${ss.getUrl()}`);
  console.log(`受信フォルダ: ${DriveApp.getFolderById(getProp_(PROP.INBOX_ID)).getUrl()}`);
}

/** ダッシュボードだけ作り直す（カテゴリを増やしたとき等）。 */
function rebuildDashboard() {
  buildDashboard_(openSpreadsheet_());
}

/** エラーフォルダの画像を受信フォルダに戻して再処理対象にする。 */
function retryErrors() {
  const inbox = DriveApp.getFolderById(getProp_(PROP.INBOX_ID, true));
  const files = DriveApp.getFolderById(getProp_(PROP.ERROR_ID, true)).getFiles();
  while (files.hasNext()) files.next().moveTo(inbox);
}

function ensureFolder_(propKey, name) {
  const id = getProp_(propKey);
  if (id) {
    try {
      return DriveApp.getFolderById(id);
    } catch (e) {
      // 削除済みなら作り直す
    }
  }
  const found = DriveApp.getRootFolder().getFoldersByName(name);
  return found.hasNext() ? found.next() : DriveApp.createFolder(name);
}

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name, ss.getNumSheets()); // 既存シートの後ろに追加
  if (headers) {
    // 列を追加したときも見出しが揃うよう、毎回1行目を書き直す
    sheet.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight('bold').setBackground('#eeeeee');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function setupSheets_(ss) {
  ensureSheet_(ss, SHEET.DASHBOARD);
  const items = ensureSheet_(ss, SHEET.ITEMS, HEADERS.ITEMS);
  const receipts = ensureSheet_(ss, SHEET.RECEIPTS, HEADERS.RECEIPTS);
  const categories = ensureSheet_(ss, SHEET.CATEGORIES, HEADERS.CATEGORIES);
  ensureSheet_(ss, SHEET.LOG, HEADERS.LOG);

  if (categories.getLastRow() < 2) {
    categories.getRange(2, 1, DEFAULT_CATEGORIES.length, 1).setValues(DEFAULT_CATEGORIES.map((c) => [c]));
  }
  categories.getRange('B2:B').setNumberFormat('¥#,##0');

  items.getRange('A2:A').setNumberFormat('yyyy/mm/dd');
  items.getRange('G2:I').setNumberFormat('¥#,##0');
  receipts.getRange('B2:B').setNumberFormat('yyyy/mm/dd');
  receipts.getRange('D2:G').setNumberFormat('¥#,##0');
  receipts.getRange('I2:I').setNumberFormat('yyyy/mm/dd hh:mm');

  const flagRange = receipts.getRange('H2:H');
  const rules = receipts.getConditionalFormatRules()
    .filter((r) => !r.getRanges().some((rg) => rg.getA1Notation() === flagRange.getA1Notation()));
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('要確認').setBackground('#f4cccc').setFontColor('#990000')
    .setRanges([flagRange]).build());
  receipts.setConditionalFormatRules(rules);
}

/**
 * 旧「レシート記録」スプレッドシートのデータを【POS】シートへ1回だけコピーする。
 * 二重コピーを防ぐため先に完了フラグを立てる（失敗しても旧シートはそのまま残る）。
 */
function migrateLegacy_(ss) {
  const legacyId = getProp_(PROP.SPREADSHEET_ID);
  if (!legacyId || legacyId === ss.getId() || getProp_(PROP.MIGRATED_TO) === ss.getId()) return;
  setProp_(PROP.MIGRATED_TO, ss.getId());

  const legacy = SpreadsheetApp.openById(legacyId);
  ['ITEMS', 'RECEIPTS', 'LOG'].forEach((key) => {
    const rows = readLegacyRows_(legacy, LEGACY_SHEET[key], HEADERS[key].length);
    if (!rows.length) return;
    const sheet = getSheet_(ss, SHEET[key]);
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  });
  const categories = readLegacyRows_(legacy, LEGACY_SHEET.CATEGORIES, HEADERS.CATEGORIES.length);
  if (categories.length) {
    const sheet = getSheet_(ss, SHEET.CATEGORIES);
    if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.CATEGORIES.length).clearContent();
    sheet.getRange(2, 1, categories.length, categories[0].length).setValues(categories);
  }
  console.log(`旧シート ${legacy.getUrl()} から【POS】シートへ移行しました`);
}

function readLegacyRows_(legacy, name, width) {
  const sheet = legacy.getSheetByName(name);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const tz = legacy.getSpreadsheetTimeZone();
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, width).getValues()
    .filter((row) => row.some((v) => v !== ''))
    .map((row) => row.map((v) => {
      if (!(v instanceof Date)) return v;
      const time = Utilities.formatDate(v, tz, 'HH:mm:ss');
      return Utilities.formatDate(v, tz, time === '00:00:00' ? 'yyyy/MM/dd' : 'yyyy/MM/dd HH:mm:ss');
    }));
}

function installTrigger_() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'processInbox')
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('processInbox').timeBased().everyMinutes(CONFIG.TRIGGER_MINUTES).create();
}
