/**
 * Gemini API 呼び出し。混雑（429/5xx）は間隔を空けてリトライし、
 * それでもダメなら transient フラグ付きの例外を投げる（呼び出し側で後回しにする）。
 */
function extractReceipt_(blob, categories) {
  const apiKey = getProp_(PROP.API_KEY, true);
  const model = getProp_(PROP.MODEL) || CONFIG.DEFAULT_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const payload = {
    contents: [{
      parts: [
        { inline_data: { mime_type: blob.getContentType(), data: Utilities.base64Encode(blob.getBytes()) } },
        { text: buildPrompt_(categories) },
      ],
    }],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: buildResponseSchema_(categories),
    },
  };
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-goog-api-key': apiKey },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  let lastError;
  for (let attempt = 0; attempt <= CONFIG.RETRY_WAITS_MS.length; attempt++) {
    if (attempt > 0) Utilities.sleep(CONFIG.RETRY_WAITS_MS[attempt - 1]);
    let res;
    try {
      res = UrlFetchApp.fetch(url, options);
    } catch (e) {
      lastError = e; // ネットワーク断・タイムアウト
      lastError.transient = true;
      continue;
    }
    const code = res.getResponseCode();
    const body = res.getContentText();
    if (code === 200) return parseGeminiResponse_(JSON.parse(body));

    lastError = new Error(`Gemini API ${code}: ${body.slice(0, 300)}`);
    if (!isRetryableStatus_(code)) throw lastError; // 400/401/403/404 はリトライしても直らない
    lastError.transient = true;
  }
  throw lastError;
}
