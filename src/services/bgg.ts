/**
 * BoardGameGeek XML API 2 Service Layer
 *
 * Endpoints used:
 * - Search:     https://boardgamegeek.com/xmlapi2/search?query=XXX&type=boardgame
 * - Collection: https://boardgamegeek.com/xmlapi2/collection?username=XXX&own=1&stats=1
 * - Thing:      https://boardgamegeek.com/xmlapi2/thing?id=XXX&stats=1
 *
 * IMPORTANT: Since July 2025, BGG requires a Bearer token for all API requests.
 * Register at https://boardgamegeek.com/using_the_xml_api to obtain a token.
 * Set the token as BGG_API_TOKEN in your .env.local file.
 */

import type { BggGameData, BggSearchResult } from "@/types/game";

const BGG_API_BASE = "https://boardgamegeek.com/xmlapi2";

function getBggToken(): string | null {
  return process.env.BGG_API_TOKEN || null;
}

/** Check if the BGG API token is configured */
export function isBggConfigured(): boolean {
  return !!getBggToken();
}

/** Build headers for BGG API requests */
function bggHeaders(): Record<string, string> {
  const token = getBggToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export interface BggImportResult {
  success: boolean;
  games: BggGameData[];
  errors: string[];
  queued: boolean;
}

/**
 * Search BGG for board games by name.
 */
export async function searchBgg(query: string): Promise<BggSearchResult[]> {
  if (!isBggConfigured()) {
    throw new Error("BGG_API_TOKEN_MISSING");
  }

  const url = `${BGG_API_BASE}/search?query=${encodeURIComponent(query)}&type=boardgame`;

  try {
    const response = await fetch(url, { headers: bggHeaders() });

    if (response.status === 401) {
      throw new Error("BGG_API_TOKEN_INVALID");
    }
    if (!response.ok) return [];

    const xml = await response.text();
    return parseSearchXml(xml);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("BGG_API_TOKEN")) throw error;
    return [];
  }
}

/**
 * Fetch a user's BGG collection.
 */
export async function fetchBggCollection(username: string): Promise<BggImportResult> {
  if (!isBggConfigured()) {
    throw new Error("BGG_API_TOKEN_MISSING");
  }

  const url = `${BGG_API_BASE}/collection?username=${encodeURIComponent(username)}&own=1&stats=1&subtype=boardgame`;

  try {
    const response = await fetch(url, { headers: bggHeaders() });

    if (response.status === 202) {
      return { success: false, games: [], errors: [], queued: true };
    }

    if (response.status === 401) {
      return {
        success: false,
        games: [],
        errors: ["BGG_API_TOKEN_INVALID"],
        queued: false,
      };
    }

    if (!response.ok) {
      return {
        success: false,
        games: [],
        errors: [`BGG API returned status ${response.status}`],
        queued: false,
      };
    }

    const xml = await response.text();
    const games = parseCollectionXml(xml);
    return { success: true, games, errors: [], queued: false };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("BGG_API_TOKEN")) throw error;
    return {
      success: false,
      games: [],
      errors: [error instanceof Error ? error.message : "Unknown error"],
      queued: false,
    };
  }
}

/**
 * Fetch detailed info for a single game by BGG ID.
 */
export async function fetchBggThing(bggId: number): Promise<BggGameData | null> {
  if (!isBggConfigured()) {
    throw new Error("BGG_API_TOKEN_MISSING");
  }

  const url = `${BGG_API_BASE}/thing?id=${bggId}&stats=1`;

  try {
    const response = await fetch(url, { headers: bggHeaders() });

    if (response.status === 401) {
      throw new Error("BGG_API_TOKEN_INVALID");
    }
    if (!response.ok) return null;

    const xml = await response.text();
    return parseThingXml(xml);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("BGG_API_TOKEN")) throw error;
    return null;
  }
}

// ─── XML Parsing ───

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
    const numPlays = extractText(block, "numplays");

    const minPlayers = extractAttr(block, "stats", "minplayers");
    const maxPlayers = extractAttr(block, "stats", "maxplayers");
    const playingTime = extractAttr(block, "stats", "playingtime");
    const minPlayTime = extractAttr(block, "stats", "minplaytime");
    const maxPlayTime = extractAttr(block, "stats", "maxplaytime");

    const weightMatch = block.match(/<averageweight\s[^>]*value="([^"]*)"[^>]*\/>/);
    const averageWeight = weightMatch ? parseFloat(weightMatch[1]) : 0;

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
    });

    void numPlays;
  }

  return games;
}

function parseThingXml(xml: string): BggGameData | null {
  const itemMatch = xml.match(/<item\s[^>]*id="(\d+)"[^>]*>([\s\S]*?)<\/item>/);
  if (!itemMatch) return null;

  const bggId = parseInt(itemMatch[1], 10);
  const block = itemMatch[2];

  const nameMatch = block.match(/<name\s[^>]*type="primary"[^>]*value="([^"]*)"[^>]*\/>/);
  const name = nameMatch ? nameMatch[1] : `Unknown (${bggId})`;

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
  };
}

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
