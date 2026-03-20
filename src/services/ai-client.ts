/**
 * AI Vision Service — Erkennt Brettspiele auf Fotos
 *
 * Unterstützte Provider:
 * - Gemini (empfohlen, kostenloser API-Key)
 * - OpenAI (GPT-4o)
 * - Claude (Anthropic)
 */

import { Capacitor } from "@capacitor/core";
import { CapacitorHttp } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

export type AiProvider = "gemini" | "openai" | "claude";
export type GameLanguage = "de" | "en";

const AI_PROVIDER_KEY = "ai_provider";
const AI_API_KEY_KEY = "ai_api_key";
const GAME_LANGUAGE_KEY = "game_language";
const USE_NATIVE_HTTP_KEY = "use_native_http";

export interface AiConfig {
  provider: AiProvider;
  apiKey: string;
}

// ─── Config Management ───

export async function getAiConfig(): Promise<AiConfig | null> {
  const { value: provider } = await Preferences.get({ key: AI_PROVIDER_KEY });
  const { value: apiKey } = await Preferences.get({ key: AI_API_KEY_KEY });

  if (!provider || !apiKey) return null;
  return { provider: provider as AiProvider, apiKey };
}

export async function setAiConfig(provider: AiProvider, apiKey: string): Promise<void> {
  await Preferences.set({ key: AI_PROVIDER_KEY, value: provider });
  await Preferences.set({ key: AI_API_KEY_KEY, value: apiKey });
}

export async function clearAiConfig(): Promise<void> {
  await Preferences.remove({ key: AI_PROVIDER_KEY });
  await Preferences.remove({ key: AI_API_KEY_KEY });
}

export async function isAiConfigured(): Promise<boolean> {
  const config = await getAiConfig();
  return config !== null && config.apiKey.length > 0;
}

// ─── Language Setting ───

export async function getGameLanguage(): Promise<GameLanguage> {
  const { value } = await Preferences.get({ key: GAME_LANGUAGE_KEY });
  return (value as GameLanguage) || "de";
}

export async function setGameLanguage(language: GameLanguage): Promise<void> {
  await Preferences.set({ key: GAME_LANGUAGE_KEY, value: language });
}

// ─── Native HTTP Setting ───

export async function getUseNativeHttp(): Promise<boolean> {
  const { value } = await Preferences.get({ key: USE_NATIVE_HTTP_KEY });
  return value === "true";
}

export async function setUseNativeHttp(enabled: boolean): Promise<void> {
  await Preferences.set({ key: USE_NATIVE_HTTP_KEY, value: String(enabled) });
}

// ─── API Connection Test ───

export interface AiTestResult {
  success: boolean;
  status: number;
  responseText: string;
  method: "fetch" | "capacitor-http" | "capacitor-http-fallback";
}

export async function testAiConnection(): Promise<AiTestResult> {
  const config = await getAiConfig();
  if (!config) throw new Error("AI_NOT_CONFIGURED");

  const useNative = await getUseNativeHttp();
  let method: AiTestResult["method"] = "fetch";

  let url: string;
  let body: unknown;
  let headers: Record<string, string> = {};

  switch (config.provider) {
    case "gemini": {
      url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${config.apiKey}`;
      body = {
        contents: [{ parts: [{ text: "Sag hallo" }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 50 },
      };
      break;
    }
    case "openai": {
      url = "https://api.openai.com/v1/chat/completions";
      body = {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "Sag hallo" }],
        max_tokens: 50,
      };
      headers = { Authorization: `Bearer ${config.apiKey}` };
      break;
    }
    case "claude": {
      url = "https://api.anthropic.com/v1/messages";
      body = {
        model: "claude-sonnet-4-20250514",
        max_tokens: 50,
        messages: [{ role: "user", content: "Sag hallo" }],
      };
      headers = {
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      };
      break;
    }
    default:
      throw new Error("UNKNOWN_PROVIDER");
  }

  let status: number;
  let data: string;

  if (useNative && Capacitor.isNativePlatform()) {
    method = "capacitor-http";
    ({ status, data } = await capacitorPost(url, body, headers));
  } else {
    try {
      ({ status, data } = await fetchPost(url, body, headers));
    } catch (err) {
      if (Capacitor.isNativePlatform()) {
        method = "capacitor-http-fallback";
        ({ status, data } = await capacitorPost(url, body, headers));
      } else {
        throw err;
      }
    }
  }

  console.log("[AI] Test result — Method:", method, "Status:", status, "Data:", data.substring(0, 500));

  return {
    success: status === 200,
    status,
    responseText: data.substring(0, 1000),
    method,
  };
}

// ─── Image Compression ───

export function compressImage(file: File, maxSizeKB: number = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;

        // Scale down if too large
        const maxDim = 1600;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, width, height);

        // Try different quality levels to stay under maxSizeKB
        let quality = 0.8;
        let base64 = canvas.toDataURL("image/jpeg", quality);

        while (base64.length > maxSizeKB * 1024 * 1.37 && quality > 0.2) {
          quality -= 0.1;
          base64 = canvas.toDataURL("image/jpeg", quality);
        }

        // Strip data URI prefix, return pure base64
        const pureBase64 = base64.split(",")[1];
        resolve(pureBase64);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Gemini Error Parsing ───

function parseGeminiError(data: string): string {
  try {
    const parsed = JSON.parse(data);
    if (parsed?.error?.message) {
      return parsed.error.message;
    }
  } catch {
    // not JSON
  }
  return data.slice(0, 200);
}

// ─── HTTP Helper ───

async function fetchPost(url: string, body: unknown, headers: Record<string, string>): Promise<{ status: number; data: string }> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  return { status: response.status, data: await response.text() };
}

async function capacitorPost(url: string, body: unknown, headers: Record<string, string>): Promise<{ status: number; data: string }> {
  const response = await CapacitorHttp.request({
    url,
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    data: body,
  });
  return {
    status: response.status,
    data: typeof response.data === "string" ? response.data : JSON.stringify(response.data),
  };
}

async function aiPost(url: string, body: unknown, headers: Record<string, string>): Promise<{ status: number; data: string }> {
  const useNative = await getUseNativeHttp();

  if (useNative && Capacitor.isNativePlatform()) {
    console.log("[AI] Using CapacitorHttp (native)");
    const result = await capacitorPost(url, body, headers);
    if (result.status !== 200) {
      console.error("[AI] CapacitorHttp error — Status:", result.status, "Data:", result.data.substring(0, 500));
    }
    return result;
  }

  // Default: use fetch() — works everywhere
  try {
    console.log("[AI] Using fetch()");
    const result = await fetchPost(url, body, headers);
    if (result.status !== 200) {
      console.error("[AI] fetch() error — Status:", result.status, "Data:", result.data.substring(0, 500));
    }
    return result;
  } catch (err) {
    // CORS error or network failure on native — fallback to CapacitorHttp
    if (Capacitor.isNativePlatform()) {
      console.warn("[AI] fetch() failed, falling back to CapacitorHttp:", err);
      const result = await capacitorPost(url, body, headers);
      if (result.status !== 200) {
        console.error("[AI] CapacitorHttp fallback error — Status:", result.status, "Data:", result.data.substring(0, 500));
      }
      return result;
    }
    throw err;
  }
}

// ─── Game Recognition ───

const RECOGNITION_PROMPT = `You are an expert board game identifier. Identify ALL board games visible in this photo.

LOOK AT: Box spines, covers, logos, artwork, any readable text.

COMMON BGG IDs (use these!):
Catan=13, Carcassonne=822, Ticket to Ride=9209, Pandemic=30549, Wingspan=266192, Ark Nova=342942, Azul=230802, 7 Wonders=68448, Codenames=178900, Dominion=36218, Terraforming Mars=167791, Spirit Island=162886, Agricola=31260, Dixit=39856, The Crew=284083, Everdell=199792, Root=237182, Scythe=169786, Brass Birmingham=224517, Great Western Trail=193738, Gloomhaven=174430, Quacks of Quedlinburg=244521, Cascadia=295947, Dorfromantik=370591, Die Crew=284083, MicroMacro=318977, Pictures=284108, Scout=291453, Splendor=148228, Century Spice Road=209685, Mysterium=181304, Takenoko=70919, Kingdomino=204583, Patchwork=163412

GERMAN NAMES: Flügelschlag=266192, Zug um Zug=9209, Die Siedler von Catan=13, Pandemie=30549, Die Quacksalber=244521

CRITICAL: You MUST provide a bggId for EVERY game. If unsure, give your best guess - the app will verify.
Set bggId to 0 ONLY if you truly cannot guess (the app will search BGG by name).

OUTPUT FORMAT - JSON array only, no markdown:
[{"name":"Game Name","bggId":12345,"confidence":"high"},{"name":"Another","bggId":0,"confidence":"low"}]

confidence: "high"=certain, "medium"=likely, "low"=guess

If no games visible: []`;

export interface RecognizedGame {
  name: string;
  bggId: number | null;
  confidence: "high" | "medium" | "low";
}

export async function recognizeGamesFromImage(base64Image: string): Promise<RecognizedGame[]> {
  const config = await getAiConfig();
  if (!config) throw new Error("AI_NOT_CONFIGURED");

  let responseText: string;

  switch (config.provider) {
    case "gemini":
      responseText = await callGemini(config.apiKey, base64Image);
      break;
    case "openai":
      responseText = await callOpenAI(config.apiKey, base64Image);
      break;
    case "claude":
      responseText = await callClaude(config.apiKey, base64Image);
      break;
    default:
      throw new Error("UNKNOWN_PROVIDER");
  }

  return parseAiResponse(responseText);
}

// ─── Provider Implementations ───

async function callGemini(apiKey: string, base64Image: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        parts: [
          { text: RECOGNITION_PROMPT },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 4096,
    },
  };

  const { status, data } = await aiPost(url, body, {});

  if (status === 403) throw new Error("AI_INVALID_KEY");
  if (status === 429) throw new Error("AI_RATE_LIMIT");
  if (status === 400) throw new Error(`AI_ERROR_400: ${parseGeminiError(data)}`);
  if (status !== 200) throw new Error(`AI_ERROR_${status}`);

  try {
    const parsed = JSON.parse(data);
    return parsed?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
  } catch {
    throw new Error("AI_INVALID_RESPONSE: Gemini returned invalid JSON");
  }
}

async function callOpenAI(apiKey: string, base64Image: string): Promise<string> {
  const url = "https://api.openai.com/v1/chat/completions";

  const body = {
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: RECOGNITION_PROMPT },
          {
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${base64Image}` },
          },
        ],
      },
    ],
    max_tokens: 4096,
    temperature: 0.2,
  };

  const { status, data } = await aiPost(url, body, {
    Authorization: `Bearer ${apiKey}`,
  });

  if (status === 401) throw new Error("AI_INVALID_KEY");
  if (status === 429) throw new Error("AI_RATE_LIMIT");
  if (status !== 200) throw new Error(`AI_ERROR_${status}`);

  try {
    const parsed = JSON.parse(data);
    return parsed?.choices?.[0]?.message?.content || "[]";
  } catch {
    throw new Error("AI_INVALID_RESPONSE: OpenAI returned invalid JSON");
  }
}

async function callClaude(apiKey: string, base64Image: string): Promise<string> {
  const url = "https://api.anthropic.com/v1/messages";

  const body = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/jpeg",
              data: base64Image,
            },
          },
          { type: "text", text: RECOGNITION_PROMPT },
        ],
      },
    ],
  };

  const { status, data } = await aiPost(url, body, {
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true",
  });

  if (status === 401) throw new Error("AI_INVALID_KEY");
  if (status === 429) throw new Error("AI_RATE_LIMIT");
  if (status !== 200) throw new Error(`AI_ERROR_${status}`);

  try {
    const parsed = JSON.parse(data);
    return parsed?.content?.[0]?.text || "[]";
  } catch {
    throw new Error("AI_INVALID_RESPONSE: Claude returned invalid JSON");
  }
}

// ─── Verification (2-Step AI Check) ───

export interface VerificationResult {
  isMatch: boolean;
  confidence: "high" | "medium" | "low";
  suggestedName?: string;
  reason?: string;
}

export async function verifyGameMatch(
  recognizedName: string,
  bggName: string,
  bggThumbnail: string | null
): Promise<VerificationResult> {
  const config = await getAiConfig();
  if (!config) throw new Error("AI_NOT_CONFIGURED");

  const language = await getGameLanguage();
  
  const prompt = `You are a board game expert. Determine if these refer to the SAME board game:

RECOGNIZED FROM PHOTO: "${recognizedName}"
BGG DATABASE RESULT: "${bggName}"

Consider:
1. Localized editions (German/English/French names are often different)
2. Subtitle variations (e.g. "Catan" vs "Die Siedler von Catan")
3. Edition names (e.g. "Ticket to Ride: Europe" vs "Zug um Zug: Europa")
4. Common abbreviations

Common German ↔ English mappings:
- Zug um Zug = Ticket to Ride
- Die Siedler von Catan = Catan
- Flügelschlag = Wingspan
- Die Quacksalber von Quedlinburg = The Quacks of Quedlinburg
- Pandemie = Pandemic
- Azul = Azul (same)
- Codenames = Codenames (same)

Respond ONLY with valid JSON (no markdown):
{
  "isMatch": true/false,
  "confidence": "high"/"medium"/"low",
  "suggestedName": "${language === "de" ? "German name if known" : "English name"}",
  "reason": "brief explanation"
}`;

  let responseText: string;

  switch (config.provider) {
    case "gemini":
      responseText = await callGeminiText(config.apiKey, prompt);
      break;
    case "openai":
      responseText = await callOpenAIText(config.apiKey, prompt);
      break;
    case "claude":
      responseText = await callClaudeText(config.apiKey, prompt);
      break;
    default:
      throw new Error("UNKNOWN_PROVIDER");
  }

  return parseVerificationResponse(responseText);
}

async function callGeminiText(apiKey: string, prompt: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const baseConfig = { temperature: 0.7, maxOutputTokens: 2048 };
  const baseBody = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: baseConfig,
  };

  // Try with google_search first, fallback without on 400
  // Note: seed is omitted when tools are present — Gemini 2.5 flash rejects seed + google_search combo
  const bodyWithTools = { ...baseBody, tools: [{ google_search: {} }] };
  console.log("[AI] callGeminiText request body:", JSON.stringify(bodyWithTools).substring(0, 1000));
  let { status, data } = await aiPost(url, bodyWithTools, {});

  if (status === 400) {
    const errMsg = parseGeminiError(data);
    console.error("[AI] callGeminiText google_search attempt — Status:", status, "Error:", errMsg, "Full data:", data.substring(0, 1000));
    console.warn("[AI] google_search failed (400), retrying without tools");
    ({ status, data } = await aiPost(url, baseBody, {}));
    if (status !== 200) {
      console.error("[AI] callGeminiText retry without tools — Status:", status, "Error:", parseGeminiError(data), "Full data:", data.substring(0, 1000));
    } else {
      console.log("[AI] callGeminiText fallback without tools succeeded");
    }
  }

  if (status === 403) throw new Error("AI_INVALID_KEY");
  if (status === 429) throw new Error("AI_RATE_LIMIT");
  if (status === 400) throw new Error(`AI_ERROR_400: ${parseGeminiError(data)}`);
  if (status !== 200) throw new Error(`AI_ERROR_${status}: ${parseGeminiError(data)}`);

  try {
    const parsed = JSON.parse(data);
    return parsed?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  } catch {
    throw new Error("AI_INVALID_RESPONSE: Gemini returned invalid JSON");
  }
}

async function callOpenAIText(apiKey: string, prompt: string): Promise<string> {
  const url = "https://api.openai.com/v1/chat/completions";

  const body = {
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 2048,
    temperature: 0.7,
  };

  const { status, data } = await aiPost(url, body, { Authorization: `Bearer ${apiKey}` });
  if (status !== 200) throw new Error(`AI_ERROR_${status}`);

  try {
    const parsed = JSON.parse(data);
    return parsed?.choices?.[0]?.message?.content || "{}";
  } catch {
    throw new Error("AI_INVALID_RESPONSE: OpenAI returned invalid JSON");
  }
}

async function callClaudeText(apiKey: string, prompt: string): Promise<string> {
  const url = "https://api.anthropic.com/v1/messages";

  const body = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    temperature: 0.7,
    messages: [{ role: "user", content: prompt }],
  };

  const { status, data } = await aiPost(url, body, {
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true",
  });
  if (status !== 200) throw new Error(`AI_ERROR_${status}`);

  try {
    const parsed = JSON.parse(data);
    return parsed?.content?.[0]?.text || "{}";
  } catch {
    throw new Error("AI_INVALID_RESPONSE: Claude returned invalid JSON");
  }
}

function parseVerificationResponse(text: string): VerificationResult {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  try {
    const parsed = JSON.parse(cleaned);
    return {
      isMatch: parsed.isMatch === true,
      confidence: ["high", "medium", "low"].includes(parsed.confidence) ? parsed.confidence : "low",
      suggestedName: parsed.suggestedName || undefined,
      reason: parsed.reason || undefined,
    };
  } catch {
    return { isMatch: false, confidence: "low", reason: "Failed to parse AI response" };
  }
}

// ─── Sale Text Generation ───

export type SaleCondition = "Wie neu" | "Gut" | "Gebrauchsspuren" | "Stark bespielt";
export type SaleExtra = "OVP" | "Sleeves" | "Erweiterungen dabei" | "Vollständig";

export interface SaleTextResult {
  text: string;
  suggestedPrice: string;
}

export async function generateSaleText(
  gameName: string,
  condition: SaleCondition,
  extras: SaleExtra[],
  playerCount: string,
  playingTime: number
): Promise<SaleTextResult> {
  const config = await getAiConfig();
  if (!config) throw new Error("AI_NOT_CONFIGURED");

  const extrasStr = extras.length > 0 ? extras.join(", ") : "keine";

  const prompt = `Erstelle einen Verkaufstext für das Brettspiel "${gameName}" auf Kleinanzeigen. Zustand: ${condition}. Extras: ${extrasStr}. Schreibe freundlich, kurz (max 100 Wörter), erwähne Spieleranzahl (${playerCount}) und Spieldauer (${playingTime} Min). Füge relevante Hashtags hinzu.

Recherchiere aktuelle Preise für "${gameName}" auf dem Gebrauchtmarkt (BGG Marketplace, Kleinanzeigen, etc.) und gib einen realistischen Preisvorschlag basierend auf dem Zustand "${condition}".

Antworte NUR mit validem JSON (kein Markdown):
{"text": "Der Verkaufstext hier...", "suggestedPrice": "XX"}

suggestedPrice soll NUR eine Zahl sein (z.B. "25"), kein €-Zeichen.`;

  let responseText: string;

  switch (config.provider) {
    case "gemini":
      responseText = await callGeminiText(config.apiKey, prompt);
      break;
    case "openai":
      responseText = await callOpenAIText(config.apiKey, prompt);
      break;
    case "claude":
      responseText = await callClaudeText(config.apiKey, prompt);
      break;
    default:
      throw new Error("UNKNOWN_PROVIDER");
  }

  return parseSaleTextResponse(responseText);
}

function parseSaleTextResponse(text: string): SaleTextResult {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  try {
    const parsed = JSON.parse(cleaned);
    return {
      text: parsed.text || "Verkaufstext konnte nicht generiert werden.",
      suggestedPrice: parsed.suggestedPrice || "?",
    };
  } catch {
    return {
      text: cleaned,
      suggestedPrice: "?",
    };
  }
}

// ─── Quick Rules ───

export async function generateQuickRules(gameName: string, mechanics: string[]): Promise<string> {
  const config = await getAiConfig();
  if (!config) throw new Error("AI_NOT_CONFIGURED");

  const mechanicsHint = mechanics.length > 0 ? `\nDas Spiel nutzt folgende Mechaniken: ${mechanics.join(", ")}.` : "";

  const prompt = `Du bist ein Brettspiel-Experte. Erkläre die KONKRETEN Regeln von "${gameName}" für jemanden der das Spiel schon mal gespielt hat aber sich nicht mehr erinnert.${mechanicsHint}

WICHTIG: Sei SPEZIFISCH für dieses Spiel! Keine generischen Aussagen wie "sammle Punkte".

**Ziel:** WIE gewinnt man konkret? (z.B. "Baue dein Weltwunder fertig ODER habe nach 3 Zeitaltern die meisten Punkte aus Gebäuden, Militär, Wissenschaft und Wunder")

**Spielablauf:**
• Wie läuft eine Runde ab? (z.B. "Alle wählen gleichzeitig 1 Karte, geben Rest weiter")
• Was kann ich mit meiner Karte machen?
• Wann endet das Spiel?

**Aktionen im Detail:**
• Welche konkreten Optionen habe ich in meinem Zug?
• Was kosten Aktionen? (Ressourcen, Geld, etc.)

**Oft vergessen:**
• 2-3 Regeln die häufig falsch gespielt werden

Beginne DIREKT mit dem Inhalt. Keine Begrüßung, keine Einleitung wie "Hallo" oder "Als Experte".
Antworte mit 150-250 Wörtern. Deutsch. Nutze • für Listen.`;

  let responseText: string;

  switch (config.provider) {
    case "gemini":
      responseText = await callGeminiText(config.apiKey, prompt);
      break;
    case "openai":
      responseText = await callOpenAIText(config.apiKey, prompt);
      break;
    case "claude":
      responseText = await callClaudeText(config.apiKey, prompt);
      break;
    default:
      throw new Error("UNKNOWN_PROVIDER");
  }

  return responseText.trim();
}

// ─── RegelGuru Chat ───

export interface RuleMessage {
  role: "user" | "assistant";
  text: string;
}

export async function askRuleQuestion(
  gameName: string,
  mechanics: string[],
  question: string,
  history: RuleMessage[]
): Promise<string> {
  const config = await getAiConfig();
  if (!config) throw new Error("AI_NOT_CONFIGURED");

  const mechanicsHint = mechanics.length > 0 ? ` Das Spiel nutzt folgende Mechaniken: ${mechanics.join(", ")}.` : "";
  const systemPrompt = `Du bist ein Regelexperte für das Brettspiel "${gameName}".${mechanicsHint} Antworte NUR basierend auf den offiziellen Regeln. Wenn du dir nicht sicher bist, sage ehrlich dass du dir nicht 100% sicher bist und empfehle die offizielle Anleitung zu prüfen. ERFINDE KEINE Regeln. Antworte kurz und präzise auf Deutsch. Nutze • für Aufzählungen. Keine Floskeln. Recherchiere die Antwort jedes Mal neu. Verlasse dich nicht auf vorherige Antworten.`;

  // Only send user questions as context (not AI responses) to prevent self-reinforcement
  const recentUserQuestions = history
    .filter((m) => m.role === "user")
    .slice(-3);

  let responseText: string;

  switch (config.provider) {
    case "gemini":
      responseText = await callGeminiChat(config.apiKey, systemPrompt, recentUserQuestions, question);
      break;
    case "openai":
      responseText = await callOpenAIChat(config.apiKey, systemPrompt, recentUserQuestions, question);
      break;
    case "claude":
      responseText = await callClaudeChat(config.apiKey, systemPrompt, recentUserQuestions, question);
      break;
    default:
      throw new Error("UNKNOWN_PROVIDER");
  }

  return responseText.trim();
}

async function callGeminiChat(apiKey: string, systemPrompt: string, history: RuleMessage[], question: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const contents = [
    { role: "user", parts: [{ text: systemPrompt }] },
    { role: "model", parts: [{ text: "Verstanden! Ich bin der Regelguru. Stelle mir deine Frage." }] },
    ...history.map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.text }],
    })),
    { role: "user", parts: [{ text: question }] },
  ];

  const baseConfig = { temperature: 0.7, maxOutputTokens: 1024 };
  const baseBody = {
    contents,
    generationConfig: baseConfig,
  };

  // Try with google_search first, fallback without on 400
  // Note: seed is omitted when tools are present — Gemini 2.5 flash rejects seed + google_search combo
  const bodyWithTools = { ...baseBody, tools: [{ google_search: {} }] };
  console.log("[AI] callGeminiChat request body:", JSON.stringify(bodyWithTools).substring(0, 1000));
  let { status, data } = await aiPost(url, bodyWithTools, {});

  if (status === 400) {
    const errMsg = parseGeminiError(data);
    console.error("[AI] callGeminiChat google_search attempt — Status:", status, "Error:", errMsg, "Full data:", data.substring(0, 1000));
    console.warn("[AI] google_search failed in chat (400), retrying without tools");
    ({ status, data } = await aiPost(url, baseBody, {}));
    if (status !== 200) {
      console.error("[AI] callGeminiChat retry without tools — Status:", status, "Error:", parseGeminiError(data), "Full data:", data.substring(0, 1000));
    } else {
      console.log("[AI] callGeminiChat fallback without tools succeeded");
    }
  }

  if (status === 403) throw new Error("AI_INVALID_KEY");
  if (status === 429) throw new Error("AI_RATE_LIMIT");
  if (status === 400) throw new Error(`AI_ERROR_400: ${parseGeminiError(data)}`);
  if (status !== 200) throw new Error(`AI_ERROR_${status}: ${parseGeminiError(data)}`);

  try {
    const parsed = JSON.parse(data);
    return parsed?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } catch {
    throw new Error("AI_INVALID_RESPONSE: Gemini returned invalid JSON");
  }
}

async function callOpenAIChat(apiKey: string, systemPrompt: string, history: RuleMessage[], question: string): Promise<string> {
  const url = "https://api.openai.com/v1/chat/completions";

  const messages = [
    { role: "system", content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.text })),
    { role: "user", content: question },
  ];

  const body = {
    model: "gpt-4o-mini",
    messages,
    max_tokens: 1024,
    temperature: 0.7,
  };

  const { status, data } = await aiPost(url, body, { Authorization: `Bearer ${apiKey}` });
  if (status === 401) throw new Error("AI_INVALID_KEY");
  if (status === 429) throw new Error("AI_RATE_LIMIT");
  if (status !== 200) throw new Error(`AI_ERROR_${status}`);

  try {
    const parsed = JSON.parse(data);
    return parsed?.choices?.[0]?.message?.content || "";
  } catch {
    throw new Error("AI_INVALID_RESPONSE: OpenAI returned invalid JSON");
  }
}

async function callClaudeChat(apiKey: string, systemPrompt: string, history: RuleMessage[], question: string): Promise<string> {
  const url = "https://api.anthropic.com/v1/messages";

  const messages = [
    ...history.map((m) => ({ role: m.role, content: m.text })),
    { role: "user" as const, content: question },
  ];

  const body = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    temperature: 0.7,
    system: systemPrompt,
    messages,
  };

  const { status, data } = await aiPost(url, body, {
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true",
  });
  if (status === 401) throw new Error("AI_INVALID_KEY");
  if (status === 429) throw new Error("AI_RATE_LIMIT");
  if (status !== 200) throw new Error(`AI_ERROR_${status}`);

  try {
    const parsed = JSON.parse(data);
    return parsed?.content?.[0]?.text || "";
  } catch {
    throw new Error("AI_INVALID_RESPONSE: Claude returned invalid JSON");
  }
}

// ─── Barcode/EAN Recognition ───

const BARCODE_PROMPT = `You are a barcode and EAN expert. Look at this photo and:
1. Find any barcode, EAN, or UPC code visible in the image
2. Read the number from the barcode
3. Identify what board game this barcode belongs to

If you can read the barcode number, search your knowledge for what board game has this EAN/UPC.
If you cannot read the barcode but can see a board game box, identify the game from the box.

Respond ONLY with valid JSON (no markdown):
{"barcode": "1234567890123", "gameName": "Name of the board game", "confidence": "high"}

If no barcode/game found: {"barcode": null, "gameName": null, "confidence": "low"}
confidence: "high"=certain, "medium"=likely, "low"=guess`;

export interface BarcodeResult {
  barcode: string | null;
  gameName: string | null;
  confidence: "high" | "medium" | "low";
}

export async function recognizeBarcodeFromImage(base64Image: string): Promise<BarcodeResult> {
  const config = await getAiConfig();
  if (!config) throw new Error("AI_NOT_CONFIGURED");

  let responseText: string;

  switch (config.provider) {
    case "gemini":
      responseText = await callGeminiBarcode(config.apiKey, base64Image);
      break;
    case "openai":
      responseText = await callOpenAIBarcode(config.apiKey, base64Image);
      break;
    case "claude":
      responseText = await callClaudeBarcode(config.apiKey, base64Image);
      break;
    default:
      throw new Error("UNKNOWN_PROVIDER");
  }

  return parseBarcodeResponse(responseText);
}

async function callGeminiBarcode(apiKey: string, base64Image: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const body = {
    contents: [{
      parts: [
        { text: BARCODE_PROMPT },
        { inlineData: { mimeType: "image/jpeg", data: base64Image } },
      ],
    }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
  };
  const { status, data } = await aiPost(url, body, {});
  if (status !== 200) throw new Error(`AI_ERROR_${status}`);
  try {
    const parsed = JSON.parse(data);
    return parsed?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  } catch {
    throw new Error("AI_INVALID_RESPONSE: Gemini returned invalid JSON");
  }
}

async function callOpenAIBarcode(apiKey: string, base64Image: string): Promise<string> {
  const url = "https://api.openai.com/v1/chat/completions";
  const body = {
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: [
        { type: "text", text: BARCODE_PROMPT },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
      ],
    }],
    max_tokens: 1024,
    temperature: 0.2,
  };
  const { status, data } = await aiPost(url, body, { Authorization: `Bearer ${apiKey}` });
  if (status !== 200) throw new Error(`AI_ERROR_${status}`);
  try {
    const parsed = JSON.parse(data);
    return parsed?.choices?.[0]?.message?.content || "{}";
  } catch {
    throw new Error("AI_INVALID_RESPONSE: OpenAI returned invalid JSON");
  }
}

async function callClaudeBarcode(apiKey: string, base64Image: string): Promise<string> {
  const url = "https://api.anthropic.com/v1/messages";
  const body = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64Image } },
        { type: "text", text: BARCODE_PROMPT },
      ],
    }],
  };
  const { status, data } = await aiPost(url, body, {
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true",
  });
  if (status !== 200) throw new Error(`AI_ERROR_${status}`);
  try {
    const parsed = JSON.parse(data);
    return parsed?.content?.[0]?.text || "{}";
  } catch {
    throw new Error("AI_INVALID_RESPONSE: Claude returned invalid JSON");
  }
}

function parseBarcodeResponse(text: string): BarcodeResult {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  try {
    const parsed = JSON.parse(cleaned);
    return {
      barcode: parsed.barcode || null,
      gameName: parsed.gameName || null,
      confidence: ["high", "medium", "low"].includes(parsed.confidence) ? parsed.confidence : "low",
    };
  } catch {
    return { barcode: null, gameName: null, confidence: "low" };
  }
}

// ─── EAN → Game Lookup (AI-based) ───

export interface EanLookupResult {
  gameName: string | null;
  confidence: "high" | "medium" | "low";
}

export async function lookupGameByEan(ean: string): Promise<EanLookupResult> {
  const config = await getAiConfig();
  if (!config) throw new Error("AI_NOT_CONFIGURED");

  const prompt = `Du bist ein Brettspiel-Experte. Welches Brettspiel hat die EAN/UPC "${ean}"?

Recherchiere in deinem Wissen. Typische Brettspiel-EANs beginnen mit 4002051 (Kosmos), 4005556 (Ravensburger), 5425016 (Repos Production), 826956 (Stonemaier Games), etc.

Antworte NUR mit validem JSON (kein Markdown):
{"gameName": "Name des Brettspiels", "confidence": "high"}

Wenn du das Spiel nicht kennst: {"gameName": null, "confidence": "low"}
confidence: "high"=sicher, "medium"=wahrscheinlich, "low"=geraten`;

  let responseText: string;
  switch (config.provider) {
    case "gemini":
      responseText = await callGeminiText(config.apiKey, prompt);
      break;
    case "openai":
      responseText = await callOpenAIText(config.apiKey, prompt);
      break;
    case "claude":
      responseText = await callClaudeText(config.apiKey, prompt);
      break;
    default:
      throw new Error("UNKNOWN_PROVIDER");
  }

  return parseEanLookupResponse(responseText);
}

function parseEanLookupResponse(text: string): EanLookupResult {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  try {
    const parsed = JSON.parse(cleaned);
    return {
      gameName: parsed.gameName || null,
      confidence: ["high", "medium", "low"].includes(parsed.confidence) ? parsed.confidence : "low",
    };
  } catch {
    return { gameName: null, confidence: "low" };
  }
}

// ─── Response Parsing ───

function parseAiResponse(text: string): RecognizedGame[] {
  // Clean up potential markdown code fences
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (item: { name?: string; bggId?: number; confidence?: string }) =>
          item && typeof item.name === "string" && item.name.trim().length > 0
      )
      .map((item: { name: string; bggId?: number; confidence?: string }) => ({
        name: item.name.trim(),
        bggId: typeof item.bggId === "number" && item.bggId > 0 ? item.bggId : null,
        confidence: (["high", "medium", "low"].includes(item.confidence || "")
          ? item.confidence
          : "medium") as "high" | "medium" | "low",
      }));
  } catch {
    // BUG-12: Return empty array instead of fragile string extraction
    return [];
  }
}
