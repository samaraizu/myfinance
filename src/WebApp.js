/**
 * スマホ入力用ウェブアプリ。アクセスはデプロイした本人のみ（appsscript.json の webapp.access = MYSELF）。
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('レシート記録')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .addMetaTag('apple-mobile-web-app-capable', 'yes')
    .addMetaTag('mobile-web-app-capable', 'yes');
}

/** 当月合計など、画面初期表示用のサマリー。 */
function getSummary() {
  const ss = openSpreadsheet_();
  return { monthTotal: getMonthTotal_(ss), spreadsheetUrl: ss.getUrl() };
}

/**
 * 画像を受け取って receipts_inbox に保存し、その場で読み取りまで実行する。
 * @param {string} base64 画像データ（data URL の接頭辞なし）
 * @param {string} mimeType
 */
function uploadReceipt(base64, mimeType) {
  if (!CONFIG.SUPPORTED_MIME.includes(mimeType)) {
    throw new Error(`未対応の形式です: ${mimeType}`);
  }
  const name = `receipt_${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss')}`;
  const blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType, name);
  const inbox = DriveApp.getFolderById(getProp_(PROP.INBOX_ID, true));

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(60 * 1000)) {
    // 自動処理が走っている。保存だけして後続のトリガーに任せる
    inbox.createFile(blob);
    return { status: 'queued', monthTotal: getMonthTotal_(openSpreadsheet_()) };
  }
  try {
    const file = inbox.createFile(blob);
    const ss = openSpreadsheet_();
    let receipt;
    try {
      receipt = processFile_(ss, file, getCategories_(ss));
    } catch (e) {
      if (e && e.transient) return { status: 'queued', reason: 'busy', monthTotal: getMonthTotal_(ss) };
      return { status: 'error', message: e && e.message ? e.message : String(e), monthTotal: getMonthTotal_(ss) };
    }
    SpreadsheetApp.flush();
    return {
      status: 'ok',
      receipt: {
        date: receipt.date,
        dateGuessed: !!receipt.dateGuessed,
        store: receipt.store,
        total: receipt.total,
        tax: receipt.tax,
        itemsSum: receipt.itemsSum,
        diff: receipt.diff,
        ok: receipt.ok,
        items: receipt.items.map((it) => ({
          name: it.name, category: it.category, quantity: it.quantity, amount: it.amount, discount: it.discount,
        })),
      },
      monthTotal: getMonthTotal_(ss),
    };
  } finally {
    lock.releaseLock();
  }
}
