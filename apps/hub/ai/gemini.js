// Gemini REST helper (Node 18+ has global fetch).
// Auto fallback models when current model is not found / not supported.

function isFallbackWorthy(respStatus, data, msg) {
  const s = respStatus;
  const m = String(msg || "").toLowerCase();
  const d = data ? JSON.stringify(data).toLowerCase() : "";

  // Model lỗi / không hỗ trợ generateContent
  if (s === 404) return true;
  if (s === 400 && (m.includes("not found") || m.includes("not supported") || m.includes("supported methods"))) return true;
  if (m.includes("call listmodels")) return true;
  if (d.includes("call listmodels")) return true;
  if (m.includes("is not found for api version")) return true;

  // tạm thời/unavailable/quota -> cũng fallback thử
  if (s === 429 || s === 503) return true;

  return false;
}

function extractText(data) {
  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((x) => x?.text || "")
      .join("")
      .trim() || "";
  return text;
}

async function callGenerateContent({ apiKey, model, system, prompt, maxOutputTokens, temperature }) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature, maxOutputTokens },
  };

  const sys = String(system || "").trim();
  if (sys) body.systemInstruction = { parts: [{ text: sys }] };

  const resp = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  let data = null;
  let rawText = "";
  try {
    data = await resp.json();
  } catch {
    rawText = await resp.text().catch(() => "");
  }

  if (!resp.ok) {
    const msg =
      data?.error?.message ||
      data?.message ||
      rawText ||
      `Gemini HTTP ${resp.status}`;
    const err = new Error(msg);
    err.status = resp.status;
    err.data = data;
    return { ok: false, err };
  }

  const text = extractText(data);
  if (!text) {
    const err = new Error("Gemini returned empty text");
    err.status = resp.status;
    err.data = data;
    return { ok: false, err };
  }

  return { ok: true, text };
}

export async function geminiGenerate({
  apiKey,
  model = "gemini-1.5-flash",
  system = "",
  prompt = "",
  maxOutputTokens = 512,
  temperature = 0.7,
}) {
  const key = String(apiKey || "").trim();
  if (!key) throw new Error("Missing GEMINI_API_KEY");

  const p = String(prompt || "").trim();
  if (!p) throw new Error("Empty prompt");

  // Danh sách model thử lần lượt
  // Lưu ý: v1beta + generateContent thường ổn định nhất với gemini-1.0-pro / gemini-pro
  const primary = String(model || "").trim();
  const fallbackModels = [
    primary,                 // model từ env / tham số
    "gemini-1.0-pro",
    "gemini-pro",
  ].filter(Boolean);

  let lastErr = null;

  for (const m of fallbackModels) {
    const result = await callGenerateContent({
      apiKey: key,
      model: m,
      system,
      prompt: p,
      maxOutputTokens,
      temperature,
    });

    if (result.ok) {
      // Trả text như trước (không đổi API)
      return result.text;
    }

    lastErr = result.err;

    const status = lastErr?.status;
    const data = lastErr?.data;
    const msg = lastErr?.message || "";

    // Nếu lỗi đáng fallback -> thử model kế tiếp
    if (isFallbackWorthy(status, data, msg)) continue;

    // Lỗi không nên fallback (ví dụ API key sai, permission…) ->xoá luôn
    throw lastErr;
  }

  throw lastErr || new Error("All Gemini models failed");
}
/**
 * Tiện ích dọn dẹp nội dung văn bản
 */
export const geminiCleanText = (text) => {
  if (!text) return "";
  return text
    .replace(/```json/g, "") // Xóa tag code json
    .replace(/```/g, "")     // Xóa tag code chung
    .trim();
};

/**
 * Hàm chuyên dụng để lấy dữ liệu JSON sạch
 * Giúp các file khác không cần parse thủ công
 */
export async function geminiGenerateJSON(options) {
  const { prompt, ...rest } = options;
  
  // Thêm chỉ dẫn ép kiểu JSON vào prompt
  const jsonPrompt = `${prompt}\n\nIMPORTANT: Return ONLY a valid JSON object. No preamble, no markdown blocks.`;
  
  try {
    const rawText = await geminiGenerateWithRetry({
      ...rest,
      prompt: jsonPrompt,
    });

    const cleaned = geminiCleanText(rawText);
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("[Gemini JSON Error]:", err.message);
    throw new Error("Failed to parse Gemini response as JSON");
  }
}

/**
 * Wrapper hỗ trợ Timeout 
 * Đảm bảo hàm không chạy quá X giây
 */
export async function geminiWithTimeout(options, ms = 30000) {
  return Promise.race([
    geminiGenerateWithRetry(options),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Gemini request timeout after ${ms}ms`)), ms)
    )
  ]);
}

/**
 * Object tập hợp các cấu hình model phổ biến để gọi cho nhanh
 */
export const GEMINI_MODELS = {
  FLASH: "gemini-1.5-flash",
  PRO: "gemini-1.5-pro",
  PRO_10: "gemini-1.0-pro"
};
