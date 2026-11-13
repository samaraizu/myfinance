/**
 * 受信フォルダの未処理画像を読み取り、記録してフォルダを振り分ける。
 */

/** 時間主導型トリガーから呼ばれるエントリーポイント。 */
function processInbox() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return; // ウェブアプリ側が処理中なら次回に回す
  try {
    const inbox = DriveApp.getFolderById(getProp_(PROP.INBOX_ID, true));
    const ss = openSpreadsheet_();
    const categories = getCategories_(ss);
    const files = inbox.getFiles();
    let count = 0;
    while (files.hasNext() && count < CONFIG.MAX_FILES_PER_RUN) {
      const file = files.next();
      if (!CONFIG.SUPPORTED_MIME.includes(file.getMimeType())) continue;
      if (count > 0) Utilities.sleep(CONFIG.INTERVAL_MS);
      count++;
      try {
        processFile_(ss, file, categories);
      } catch (e) {
        // ログ・フォルダ移動は processFile_ 内で済み。混雑中なら残りは次回に回す
        if (e && e.transient) break;
      }
    }
  } finally {
    lock.releaseLock();
  }
}

/**
 * 1ファイルを処理する。ロック取得は呼び出し側の責務。
 * 成功時は記録内容を返し、失敗時はエラーフォルダへ移動して例外を投げる。
 */
function processFile_(ss, file, categories) {
  const fileId = file.getId();
  if (isProcessed_(ss, fileId)) {
    file.moveTo(DriveApp.getFolderById(getProp_(PROP.DONE_ID, true)));
    log_('WARN', file, '登録済みのためスキップ（二重登録防止）');
    return { duplicate: true };
  }
  try {
    const raw = extractReceipt_(file.getBlob(), categories);
    const receipt = normalizeReceipt_(raw, categories, CONFIG.TOTAL_TOLERANCE);
    if (!receipt.date) {
      receipt.date = Utilities.formatDate(file.getDateCreated(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
      receipt.dateGuessed = true;
    }
    file.moveTo(DriveApp.getFolderById(getProp_(PROP.DONE_ID, true)));
    saveReceipt_(ss, fileId, file.getUrl(), receipt);
    log_(receipt.ok ? 'INFO' : 'WARN', file,
      `${receipt.store} ¥${receipt.total} / ${receipt.items.length}品目` +
      (receipt.ok ? '' : ` / 明細合計と差額 ${receipt.diff}円`) +
      (receipt.dateGuessed ? ' / 日付読めずファイル作成日を使用' : ''));
    return receipt;
  } catch (e) {
    if (e && e.transient) {
      // 一時的な混雑：受信フォルダに残し、次回のトリガーで再処理
      log_('WARN', file, `Gemini混雑のため後で再処理: ${e.message}`);
      throw e;
    }
    try {
      file.moveTo(DriveApp.getFolderById(getProp_(PROP.ERROR_ID, true)));
    } catch (moveError) {
      console.error(moveError);
    }
    log_('ERROR', file, e && e.message ? e.message : e);
    throw e;
  }
}
