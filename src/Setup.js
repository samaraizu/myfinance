/**
 * 初期セットアップ。エディタから setup() を1回実行する。
 * 何度実行しても既存のフォルダ・シート・データは壊さない。
 */
function setup() {
  getProp_(PROP.API_KEY, true);

  setProp_(PROP.INBOX_ID, ensureFolder_(PROP.INBOX_ID, FOLDER.INBOX).getId());
  setProp_(PROP.DONE_ID, ensureFolder_(PROP.DONE_ID, FOLDER.DONE).getId());
  setProp_(PROP.ERROR_ID, ensureFolder_(PROP.ERROR_ID, FOLDER.ERROR).getId());

  const ss = ensureSpreadsheet_();
  setupSheets_(ss);
  buildDashboard_(ss);
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

function ensureSpreadsheet_() {
  const id = getProp_(PROP.SPREADSHEET_ID);
  if (id) {
    try {
      return SpreadsheetApp.openById(id);
    } catch (e) {
      // 削除済みなら作り直す
    }
  }
  const ss = SpreadsheetApp.create('レシート記録');
  ss.setSpreadsheetTimeZone('Asia/Tokyo');
  setProp_(PROP.SPREADSHEET_ID, ss.getId());
  return ss;
}

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (headers && sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight('bold').setBackground('#eeeeee');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function setupSheets_(ss) {
  const dashboard = ensureSheet_(ss, SHEET.DASHBOARD);
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

  // 初期作成時の「シート1」を消してダッシュボードを先頭に
  const blank = ss.getSheetByName('シート1') || ss.getSheetByName('Sheet1');
  if (blank && ss.getSheets().length > 1) ss.deleteSheet(blank);
  ss.setActiveSheet(dashboard);
  ss.moveActiveSheet(1);
}

function installTrigger_() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'processInbox')
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('processInbox').timeBased().everyMinutes(CONFIG.TRIGGER_MINUTES).create();
}
