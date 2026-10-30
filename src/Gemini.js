/**
 * Gemini API 呼び出し。APIエラー時は1回だけリトライする。
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
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) Utilities.sleep(CONFIG.RETRY_WAIT_MS);
    try {
      const res = UrlFetchApp.fetch(url, options);
      const code = res.getResponseCode();
      const body = res.getContentText();
      if (code !== 200) {
        lastError = new Error(`Gemini API ${code}: ${body.slice(0, 300)}`);
        if (code === 400 || code === 401 || code === 403 || code === 404) break; // リトライしても直らない
        continue;
      }
      return parseGeminiResponse_(JSON.parse(body));
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}
