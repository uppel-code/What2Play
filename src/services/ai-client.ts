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

// ─── HTTP Helper ───

async function aiPost(url: string, body: unknown, headers: Record<string, string>): Promise<{ status: number; data: string }> {
  if (Capacitor.isNativePlatform()) {
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

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  return { status: response.status, data: await response.text() };
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

  if (status === 400) throw new Error("AI_INVALID_KEY");
  if (status === 403) throw new Error("AI_INVALID_KEY");
  if (status === 429) throw new Error("AI_RATE_LIMIT");
  if (status !== 200) throw new Error(`AI_ERROR_${status}`);

  const parsed = JSON.parse(data);
  return parsed?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
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

  const parsed = JSON.parse(data);
  return parsed?.choices?.[0]?.message?.content || "[]";
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

  const parsed = JSON.parse(data);
  return parsed?.content?.[0]?.text || "[]";
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

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 512 },
  };

  const { status, data } = await aiPost(url, body, {});
  if (status !== 200) throw new Error(`AI_ERROR_${status}`);

  const parsed = JSON.parse(data);
  return parsed?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
}

async function callOpenAIText(apiKey: string, prompt: string): Promise<string> {
  const url = "https://api.openai.com/v1/chat/completions";

  const body = {
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 512,
    temperature: 0.1,
  };

  const { status, data } = await aiPost(url, body, { Authorization: `Bearer ${apiKey}` });
  if (status !== 200) throw new Error(`AI_ERROR_${status}`);

  const parsed = JSON.parse(data);
  return parsed?.choices?.[0]?.message?.content || "{}";
}

async function callClaudeText(apiKey: string, prompt: string): Promise<string> {
  const url = "https://api.anthropic.com/v1/messages";

  const body = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  };

  const { status, data } = await aiPost(url, body, {
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true",
  });
  if (status !== 200) throw new Error(`AI_ERROR_${status}`);

  const parsed = JSON.parse(data);
  return parsed?.content?.[0]?.text || "{}";
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
    // Try to extract game names even from non-JSON response
    const names = text.match(/"([^"]+)"/g);
    if (names && names.length > 0) {
      return names
        .map((n) => n.replace(/"/g, ""))
        .filter((n) => n.length > 2 && !["name", "confidence", "high", "medium", "low", "bggId"].includes(n))
        .map((name) => ({ name, bggId: null, confidence: "low" as const }));
    }
    return [];
  }
}
