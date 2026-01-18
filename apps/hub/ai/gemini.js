// Gemini REST helper (Node 18+ has global fetch).
// ✅ Auto fallback models when current model is not found / not supported.

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

  // ✅ Danh sách model thử lần lượt
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
      // ✅ Trả text như trước (không đổi API)
      return result.text;
    }

    lastErr = result.err;

    const status = lastErr?.status;
    const data = lastErr?.data;
    const msg = lastErr?.message || "";

    // ✅ Nếu lỗi đáng fallback -> thử model kế tiếp
    if (isFallbackWorthy(status, data, msg)) continue;

    // ❌ Lỗi không nên fallback (ví dụ API key sai, permission…) -> ném luôn
    throw lastErr;
  }

  throw lastErr || new Error("All Gemini models failed");
}
