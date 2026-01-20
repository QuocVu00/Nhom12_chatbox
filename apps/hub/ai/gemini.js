function isFallbackWorthy(respStatus, data, msg) {
  const s = respStatus;
  const m = String(msg || "").toLowerCase();
  const d = data ? JSON.stringify(data).toLowerCase() : "";

  if (s === 404) return true;
  if (s === 400 && (m.includes("not found") || m.includes("not supported") || m.includes("supported methods"))) return true;
  if (m.includes("call listmodels") || d.includes("call listmodels") || m.includes("is not found for api version")) return true;

  if (s === 429 || s === 503) return true;

  return false;
}

function extractText(data) {
  return data?.candidates?.[0]?.content?.parts?.map((x) => x?.text || "").join("").trim() || "";
}

async function callGenerateContent({ apiKey, model, system, prompt, maxOutputTokens, temperature }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

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
    const msg = data?.error?.message || data?.message || rawText || `Gemini HTTP ${resp.status}`;
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

  const primary = String(model || "").trim();
  const fallbackModels = [primary, "gemini-1.0-pro", "gemini-pro"].filter(Boolean);

  let lastErr = null;

  for (const m of fallbackModels) {
    const result = await callGenerateContent({ apiKey: key, model: m, system, prompt: p, maxOutputTokens, temperature });

    if (result.ok) return result.text;

    lastErr = result.err;
    if (isFallbackWorthy(lastErr?.status, lastErr?.data, lastErr?.message)) continue;
    throw lastErr;
  }
  throw lastErr || new Error("All Gemini models failed");
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export async function geminiGenerateWithRetry(options) {
  const { maxRetries = 3, initialDelay = 2000, ...rest } = options;
  let lastError = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await geminiGenerate(rest);
    } catch (err) {
      lastError = err;
      const shouldRetry = err.status === 429 || err.status === 503 || !err.status;
      if (shouldRetry && attempt < maxRetries - 1) {
        const waitTime = initialDelay * Math.pow(2, attempt);
        console.warn(`[Gemini] Thử lại lần ${attempt + 1}/${maxRetries} sau ${waitTime}ms...`);
        await delay(waitTime);
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

export const geminiCleanText = (text) => {
  if (!text) return "";
  return text.replace(/```json/g, "").replace(/```/g, "").trim();
};

export async function geminiGenerateJSON(options) {
  const { prompt, ...rest } = options;
  const jsonPrompt = `${prompt}\n\nIMPORTANT: Return ONLY a valid JSON object. No preamble, no markdown blocks.`;
  
  try {
    const rawText = await geminiGenerateWithRetry({ ...rest, prompt: jsonPrompt });
    const cleaned = geminiCleanText(rawText);
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("[Gemini JSON Error]:", err.message);
    throw new Error("Failed to parse Gemini response as JSON");
  }
}

export async function geminiWithTimeout(options, ms = 30000) {
  return Promise.race([
    geminiGenerateWithRetry(options),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Gemini request timeout after ${ms}ms`)), ms)
    )
  ]);
}

export const askGemini = (prompt, apiKey, model = "gemini-1.5-flash") => {
  return geminiGenerateWithRetry({ prompt, apiKey, model, temperature: 0.7 });
};

export const GEMINI_MODELS = {
  FLASH: "gemini-1.5-flash",
  PRO: "gemini-1.5-pro",
  PRO_10: "gemini-1.0-pro"
};