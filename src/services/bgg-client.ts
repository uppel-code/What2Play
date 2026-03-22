/**
 * Client-Side BGG XML API 2 Service
 *
 * Platform detection:
 * - Capacitor (APK): Uses CapacitorHttp to bypass CORS
 * - Browser (dev): Uses /api/bgg/* proxy routes
 */

import type { BggGameData, BggSearchResult } from "@/types/game";
import { Capacitor } from "@capacitor/core";
import { CapacitorHttp } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { getGameLanguage } from "@/services/ai-client";

const BGG_API_BASE = "https://boardgamegeek.com/xmlapi2";
const TOKEN_KEY = "bgg_api_token";
const DEFAULT_TOKEN = "2cf7ef15-eecb-4d64-9668-a87fa1911f61";

// ─── Token Management ───

export async function getBggToken(): Promise<string | null> {
  if (Capacitor.isNativePlatform()) {
    const { value } = await Preferences.get({ key: TOKEN_KEY });
    // Return saved token, or fall back to default
    return value || DEFAULT_TOKEN;
  }
  // In browser mode, also return default token for direct use
  return DEFAULT_TOKEN;
}

export async function setBggToken(token: string): Promise<void> {
  await Preferences.set({ key: TOKEN_KEY, value: token });
}

export async function isBggConfigured(): Promise<boolean> {
  const token = await getBggToken();
  return !!token;
}

export interface BggTestResult {
  success: boolean;
  status: number;
  message: string;
}

export async function testBggConnection(): Promise<BggTestResult> {
  const token = await getBggToken();
  if (!token) return { success: false, status: 0, message: "Kein BGG Token konfiguriert." };

  try {
    // Simple search query to verify the token works
    const url = `${BGG_API_BASE}/search?query=Catan&type=boardgame&exact=1`;
    const { status, data } = await bggFetch(url);
    if (status === 401) return { success: false, status, message: "Token ungültig oder abgelaufen." };
    if (status === 200) {
      const count = (data.match(/<item /g) || []).length;
      return { success: true, status, message: `Verbindung OK — ${count} Ergebnis(se) für Testsuche.` };
    }
    return { success: false, status, message: `Unerwarteter Status: ${status}` };
  } catch (err) {
    return { success: false, status: 0, message: err instanceof Error ? err.message : String(err) };
  }
}

// ─── HTTP Helper ───

async function bggFetch(url: string): Promise<{ status: number; data: string }> {
  const token = await getBggToken();
  if (!token) throw new Error("BGG_API_TOKEN_MISSING");

  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.request({
      url,
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    return { status: response.status, data: response.data };
  }

  // Browser mode: direct fetch with token (works for same-origin or CORS-enabled endpoints)
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: response.status, data: await response.text() };
}

// ─── BGG API Functions ───

export interface BggImportResult {
  success: boolean;
  games: BggGameData[];
  errors: string[];
  queued: boolean;
}

export async function searchBgg(query: string): Promise<BggSearchResult[]> {
  const url = `${BGG_API_BASE}/search?query=${encodeURIComponent(query)}&type=boardgame`;
  try {
    const { status, data } = await bggFetch(url);
    if (status === 401) throw new Error("BGG_API_TOKEN_INVALID");
    if (status !== 200) return [];
    return parseSearchXml(data);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("BGG_API_TOKEN")) throw error;
    return [];
  }
}

export async function fetchBggThing(bggId: number): Promise<BggGameData | null> {
  const url = `${BGG_API_BASE}/thing?id=${bggId}&stats=1&versions=1`;
  try {
    const [{ status, data }, language] = await Promise.all([bggFetch(url), getGameLanguage()]);
    if (status === 401) throw new Error("BGG_API_TOKEN_INVALID");
    if (status !== 200) return null;
    return parseThingXml(data, language);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("BGG_API_TOKEN")) throw error;
    return null;
  }
}

export async function fetchBggCollection(username: string): Promise<BggImportResult> {
  const url = `${BGG_API_BASE}/collection?username=${encodeURIComponent(username)}&own=1&stats=1&subtype=boardgame`;
  try {
    const { status, data } = await bggFetch(url);
    if (status === 202) return { success: false, games: [], errors: [], queued: true };
    if (status === 401) return { success: false, games: [], errors: ["BGG_API_TOKEN_INVALID"], queued: false };
    if (status !== 200) return { success: false, games: [], errors: [`BGG API status ${status}`], queued: false };
    const games = parseCollectionXml(data);
    return { success: true, games, errors: [], queued: false };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("BGG_API_TOKEN")) throw error;
    return { success: false, games: [], errors: [String(error)], queued: false };
  }
}

export async function searchExpansions(parentBggId: number): Promise<BggSearchResult[]> {
  // BGG thing endpoint includes expansion links — fetch the parent game and extract them
  const url = `${BGG_API_BASE}/thing?id=${parentBggId}&type=boardgame`;
  try {
    const { status, data } = await bggFetch(url);
    if (status === 401) throw new Error("BGG_API_TOKEN_INVALID");
    if (status !== 200) return [];
    return parseExpansionLinks(data);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("BGG_API_TOKEN")) throw error;
    return [];
  }
}

export async function searchExpansionsByName(gameName: string): Promise<BggSearchResult[]> {
  // Fallback: search BGG for "[gameName]" with type=boardgameexpansion
  const url = `${BGG_API_BASE}/search?query=${encodeURIComponent(gameName)}&type=boardgameexpansion`;
  try {
    const { status, data } = await bggFetch(url);
    if (status === 401) throw new Error("BGG_API_TOKEN_INVALID");
    if (status !== 200) return [];
    return parseSearchXml(data);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("BGG_API_TOKEN")) throw error;
    return [];
  }
}

// ─── XML Parsing (copied from server bgg.ts — pure string parsing, no Node deps) ───

function parseSearchXml(xml: string): BggSearchResult[] {
  const results: BggSearchResult[] = [];
  const itemRegex = /<item\s[^>]*id="(\d+)"[^>]*>([\s\S]*?)<\/item>/g;

  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const bggId = parseInt(match[1], 10);
    const block = match[2];

    const nameMatch = block.match(/<name\s[^>]*value="([^"]*)"[^>]*\/>/);
    const name = nameMatch ? nameMatch[1] : `Unknown (${bggId})`;

    const yearMatch = block.match(/<yearpublished\s[^>]*value="([^"]*)"[^>]*\/>/);
    const yearpublished = yearMatch ? parseInt(yearMatch[1], 10) : null;

    results.push({ bggId, name, yearpublished });
  }

  results.sort((a, b) => {
    if (a.yearpublished && b.yearpublished) return b.yearpublished - a.yearpublished;
    if (a.yearpublished) return -1;
    if (b.yearpublished) return 1;
    return a.name.localeCompare(b.name);
  });

  return results;
}

function parseThingXml(xml: string, preferredLanguage: string = "en"): BggGameData | null {
  const itemMatch = xml.match(/<item\s[^>]*id="(\d+)"[^>]*>([\s\S]*?)<\/item>/);
  if (!itemMatch) return null;

  const bggId = parseInt(itemMatch[1], 10);
  const block = itemMatch[2];

  // Extract primary name (usually English)
  const primaryMatch = block.match(/<name\s[^>]*type="primary"[^>]*value="([^"]*)"[^>]*\/>/);
  const primaryName = primaryMatch ? decodeXmlEntities(primaryMatch[1]) : `Unknown (${bggId})`;

  // Try to find a localized name if language is not English
  let name = primaryName;
  if (preferredLanguage !== "en") {
    // Check if a version in the preferred language exists (BGG versions have explicit language tags)
    const languageMap: Record<string, string> = { de: "German", fr: "French", es: "Spanish", it: "Italian", nl: "Dutch", pt: "Portuguese" };
    const targetLang = languageMap[preferredLanguage];
    const hasTargetVersion = targetLang
      ? new RegExp(`<link\\s[^>]*type="language"[^>]*value="${targetLang}"`, "i").test(xml)
      : false;

    if (hasTargetVersion) {
      const altNameRegex = /<name\s[^>]*type="alternate"[^>]*value="([^"]*)"[^>]*\/>/g;
      const alternateNames: string[] = [];
      // Only parse alternate names from the main item block (before <versions>)
      const mainBlock = xml.includes("<versions>") ? xml.split("<versions>")[0] : block;
      let altMatch;
      while ((altMatch = altNameRegex.exec(mainBlock)) !== null) {
        alternateNames.push(decodeXmlEntities(altMatch[1]));
      }
      if (preferredLanguage === "de" && alternateNames.length > 0) {
        const germanName = pickGermanName(alternateNames, primaryName);
        if (germanName) {
          name = germanName;
        }
      }
    }
  }

  const minPlayers = extractSelfClosingValue(block, "minplayers");
  const maxPlayers = extractSelfClosingValue(block, "maxplayers");
  const playingTime = extractSelfClosingValue(block, "playingtime");
  const minPlayTime = extractSelfClosingValue(block, "minplaytime");
  const maxPlayTime = extractSelfClosingValue(block, "maxplaytime");
  const minAge = extractSelfClosingValue(block, "minage");
  const yearpublished = extractSelfClosingValue(block, "yearpublished");

  const thumbnail = extractText(block, "thumbnail");
  const image = extractText(block, "image");

  const weightMatch = block.match(/<averageweight\s[^>]*value="([^"]*)"[^>]*\/>/);
  const averageWeight = weightMatch ? parseFloat(weightMatch[1]) : 0;

  const categories: string[] = [];
  const mechanics: string[] = [];
  const linkRegex = /<link\s[^>]*type="([^"]*)"[^>]*value="([^"]*)"[^>]*\/>/g;
  let linkMatch;
  while ((linkMatch = linkRegex.exec(block)) !== null) {
    if (linkMatch[1] === "boardgamecategory") categories.push(linkMatch[2]);
    if (linkMatch[1] === "boardgamemechanic") mechanics.push(linkMatch[2]);
  }

  const ratingMatch = block.match(/<average\s[^>]*value="([^"]*)"[^>]*\/>/);
  const bggRating = ratingMatch ? parseFloat(ratingMatch[1]) : null;

  const rankRegex = /<rank[^>]*type="subtype"[^>]*name="boardgame"[^>]*value="([^"]*)"[^>]*\/>/;
  const rankMatch = block.match(rankRegex);
  const bggRank = rankMatch && rankMatch[1] !== "Not Ranked" ? parseInt(rankMatch[1], 10) : null;

  return {
    bggId,
    name,
    yearpublished: yearpublished ? parseInt(yearpublished, 10) : null,
    minPlayers: parseInt(minPlayers || "1", 10),
    maxPlayers: parseInt(maxPlayers || "4", 10),
    playingTime: parseInt(playingTime || "30", 10),
    minPlayTime: parseInt(minPlayTime || "0", 10),
    maxPlayTime: parseInt(maxPlayTime || "0", 10),
    minAge: parseInt(minAge || "0", 10),
    averageWeight,
    thumbnail: thumbnail || null,
    image: image || null,
    categories,
    mechanics,
    bggRating: bggRating && bggRating > 0 ? Math.round(bggRating * 10) / 10 : null,
    bggRank,
  };
}

function parseCollectionXml(xml: string): BggGameData[] {
  const games: BggGameData[] = [];
  const itemRegex = /<item\s[^>]*objectid="(\d+)"[^>]*>([\s\S]*?)<\/item>/g;

  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const bggId = parseInt(match[1], 10);
    const block = match[2];

    const name = extractText(block, "name");
    const thumbnail = extractText(block, "thumbnail");
    const image = extractText(block, "image");
    const yearpublished = extractText(block, "yearpublished");

    const minPlayers = extractAttr(block, "stats", "minplayers");
    const maxPlayers = extractAttr(block, "stats", "maxplayers");
    const playingTime = extractAttr(block, "stats", "playingtime");
    const minPlayTime = extractAttr(block, "stats", "minplaytime");
    const maxPlayTime = extractAttr(block, "stats", "maxplaytime");

    const weightMatch = block.match(/<averageweight\s[^>]*value="([^"]*)"[^>]*\/>/);
    const averageWeight = weightMatch ? parseFloat(weightMatch[1]) : 0;

    const ratingMatch = block.match(/<average\s[^>]*value="([^"]*)"[^>]*\/>/);
    const bggRating = ratingMatch ? parseFloat(ratingMatch[1]) : null;

    const rankRegex = /<rank[^>]*type="subtype"[^>]*name="boardgame"[^>]*value="([^"]*)"[^>]*\/>/;
    const rankMatch = block.match(rankRegex);
    const bggRank = rankMatch && rankMatch[1] !== "Not Ranked" ? parseInt(rankMatch[1], 10) : null;

    games.push({
      bggId,
      name: name || `Unknown (${bggId})`,
      yearpublished: yearpublished ? parseInt(yearpublished, 10) : null,
      minPlayers: parseInt(minPlayers || "1", 10),
      maxPlayers: parseInt(maxPlayers || "4", 10),
      playingTime: parseInt(playingTime || "30", 10),
      minPlayTime: parseInt(minPlayTime || "0", 10),
      maxPlayTime: parseInt(maxPlayTime || "0", 10),
      minAge: 0,
      averageWeight,
      thumbnail: thumbnail || null,
      image: image || null,
      categories: [],
      mechanics: [],
      bggRating: bggRating && bggRating > 0 ? Math.round(bggRating * 10) / 10 : null,
      bggRank,
    });
  }

  return games;
}

function parseExpansionLinks(xml: string): BggSearchResult[] {
  const results: BggSearchResult[] = [];
  const linkRegex = /<link\s[^>]*type="boardgameexpansion"[^>]*id="(\d+)"[^>]*value="([^"]*)"[^>]*\/>/g;

  let match;
  while ((match = linkRegex.exec(xml)) !== null) {
    const bggId = parseInt(match[1], 10);
    const name = match[2];
    results.push({ bggId, name, yearpublished: null });
  }

  results.sort((a, b) => a.name.localeCompare(b.name));
  return results;
}

// ─── German Name Detection ───
// BGG doesn't tag alternate names with language codes.
// Strategy: 1) Remove non-Latin scripts, 2) Remove known non-German languages,
// 3) Score remaining for German signals, 4) Pick best or shortest at tie.

// Step 1: Filter non-Latin scripts (Greek, Cyrillic, Hebrew, Arabic, Thai, CJK, Korean etc.)
const NON_LATIN_SCRIPT = /[\u0370-\u03FF\u0400-\u04FF\u0590-\u05FF\u0600-\u06FF\u0E00-\u0E7F\u3000-\u9FFF\uAC00-\uD7AF\uFB50-\uFDFF\uFE70-\uFEFF]/;

// Step 2: Known non-German language patterns
const NON_GERMAN_PATTERNS = [
  /[àâçéèêëîïôùûœæ]/i,                                             // French accents
  /^(les|le|la|l'|un|une|des|du|de la)\b/i,                        // French articles
  /\b(quête|neuvième|planète|anniversaire|haricots|aventuriers)\b/i, // French words
  /\b(juego|búsqueda|los|las|del|para|al|puñado|judías)\b/i,       // Spanish
  /[ñ¡¿]/,                                                          // Spanish chars
  /\b(jogo|uma|pela|busca|nono|tripulação)\b/i,                    // Portuguese
  /\b(gioco|scoperta|pianeta|nuova|sfida|codice|nome|pandemia)\b/i, // Italian
  /\b(spel|het|van|een|voor|uit|tot|weg|planeet|editie)\b/i,       // Dutch
  /\b(dobbel|vouwen|kaart|bordspel)\b/i,                             // Dutch game words
  /[ąćęłńóśźżŁ]/,                                                  // Polish diacritics
  /\b(tajniacy|poszukiwaniu|dziewiątej|fasolki)\b/i,               // Polish words
  /[őűŐŰ]/,                                                        // Hungarian specific chars
  /\b(küldetés|bolygó|szüret|csoda|fesztáv|szellemek|szigete|babszüret)\b/i, // Hungarian words
  /[řšťžůčěďňŘŠŤŽŮČĚĎŇ]/,                                        // Czech/Slovak
  /[ăâțșĂÂȚȘ]/,                                                    // Romanian
  /\b(căutarea|lumea|păsărilor|nume|cod)\b/i,                        // Romanian words
  /\b(potraga|izdanje|iskanje|posada|společně)\b/i,                 // South Slavic/Czech
  /\b(keşif|gezegen|görevi)\b/i,                                    // Turkish
  /[āēīōūĀĒĪŌŪ]/,                                                 // Latvian/Lithuanian
  /\b(edition|quest|anniversary|the\b.*\bquest)\b/i,                // English
  /\b(afrikaans|edisi|indonesia)\b/i,                               // Other
  /\b(menolippu|valtakunta|uudisasukkaat|tiivulised)\b/i,          // Finnish/Estonian
  /\b(fazole|duchové|ostrova|odysea)\b/i,                          // Czech words
  /\b(codi|secret|codinomes|código|secreto)\b/i,                   // Catalan/Spanish/Portuguese
];

// Step 3: Positive German signals (with weights)
const GERMAN_SIGNALS: [RegExp, number][] = [
  [/[äöüßÄÖÜ]/, 3],                                                               // Umlauts (strong)
  [/\b(der|die|das|des|dem|den|ein|eine|einer|eines|einem)\b/i, 3],                 // Articles
  [/\b(und|oder|für|von|zu|mit|auf|aus|bei|nach|über|unter|um|zum|zur)\b/i, 2],     // Prepositions
  [/\b(nicht|ist|sind|wird|kann|muss|soll|darf|hat|haben|reist|gemeinsam|glaub)\b/i, 2], // Verbs
  [/\b(Spiel|Abenteuer|Reise|Welt|Stadt|Nacht|Karte|Würfel|Planeten|Jahre)\b/i, 2], // Game words
  [/\b(große|kleine|neue|erste|letzte|schnelle)\b/i, 1],                           // Adjectives
  [/(?:ung|heit|keit|lich|isch|chen|tion|ieren)\b/i, 1],                           // German suffixes
];

function pickGermanName(alternateNames: string[], _primaryName: string): string | null {
  // Step 1: Remove non-Latin scripts
  let candidates = alternateNames.filter((n) => !NON_LATIN_SCRIPT.test(n));
  if (candidates.length === 0) return null;

  // Step 2: Remove known non-German languages
  candidates = candidates.filter((n) => !NON_GERMAN_PATTERNS.some((p) => p.test(n)));
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  // Step 3: Score remaining for German signals
  const scored = candidates.map((n) => {
    let score = 0;
    for (const [pattern, weight] of GERMAN_SIGNALS) {
      if (pattern.test(n)) score += weight;
    }
    return { name: n, score };
  });

  // Penalize special/anniversary editions — prefer base game names
  for (const s of scored) {
    if (/\b(jubil\w*|anniversary|aniversario|édition|sonder\w*|special|limited)\b/i.test(s.name)) {
      s.score = Math.max(0, s.score - 6);
    }
  }

  // Sort by score desc, then by shortest name (prefer base game over editions)
  scored.sort((a, b) => b.score - a.score || a.name.length - b.name.length);
  return scored[0].name;
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
}

function extractText(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  return match ? match[1].trim() : null;
}

function extractAttr(block: string, tag: string, attr: string): string | null {
  const match = block.match(new RegExp(`<${tag}\\s[^>]*${attr}="([^"]*)"[^>]*`));
  return match ? match[1] : null;
}

function extractSelfClosingValue(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}\\s[^>]*value="([^"]*)"[^>]*\\/?>`));
  return match ? match[1] : null;
}
