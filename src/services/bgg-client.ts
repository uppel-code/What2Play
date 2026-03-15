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

const BGG_API_BASE = "https://boardgamegeek.com/xmlapi2";
const TOKEN_KEY = "bgg_api_token";

// ─── Token Management ───

export async function getBggToken(): Promise<string | null> {
  if (Capacitor.isNativePlatform()) {
    const { value } = await Preferences.get({ key: TOKEN_KEY });
    return value || null;
  }
  // In browser mode, token is handled by the API proxy
  return null;
}

export async function setBggToken(token: string): Promise<void> {
  await Preferences.set({ key: TOKEN_KEY, value: token });
}

export async function isBggConfigured(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    const token = await getBggToken();
    return !!token;
  }
  // In browser dev mode, check the proxy status endpoint
  try {
    const res = await fetch("/api/bgg/status");
    const data = await res.json();
    return data.configured;
  } catch {
    return false;
  }
}

// ─── HTTP Helper ───

async function bggFetch(url: string): Promise<{ status: number; data: string }> {
  if (Capacitor.isNativePlatform()) {
    const token = await getBggToken();
    if (!token) throw new Error("BGG_API_TOKEN_MISSING");

    const response = await CapacitorHttp.request({
      url,
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    return { status: response.status, data: response.data };
  }

  // Browser mode: use proxy
  const proxyUrl = url.replace(BGG_API_BASE, "/api/bgg/proxy");
  const response = await fetch(proxyUrl);
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
  if (Capacitor.isNativePlatform()) {
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

  // Browser dev mode: use existing API route
  try {
    const res = await fetch(`/api/bgg/search?q=${encodeURIComponent(query)}`);
    if (res.status === 503) throw new Error("BGG_API_TOKEN_MISSING");
    if (res.status === 401) throw new Error("BGG_API_TOKEN_INVALID");
    if (!res.ok) return [];
    return await res.json();
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("BGG_API_TOKEN")) throw error;
    return [];
  }
}

export async function fetchBggThing(bggId: number): Promise<BggGameData | null> {
  if (Capacitor.isNativePlatform()) {
    const url = `${BGG_API_BASE}/thing?id=${bggId}&stats=1`;
    try {
      const { status, data } = await bggFetch(url);
      if (status === 401) throw new Error("BGG_API_TOKEN_INVALID");
      if (status !== 200) return null;
      return parseThingXml(data);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("BGG_API_TOKEN")) throw error;
      return null;
    }
  }

  // Browser dev mode
  try {
    const res = await fetch(`/api/bgg/thing?id=${bggId}`);
    if (res.status === 503) throw new Error("BGG_API_TOKEN_MISSING");
    if (res.status === 401) throw new Error("BGG_API_TOKEN_INVALID");
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("BGG_API_TOKEN")) throw error;
    return null;
  }
}

export async function fetchBggCollection(username: string): Promise<BggImportResult> {
  if (Capacitor.isNativePlatform()) {
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

  // Browser dev mode
  try {
    const res = await fetch("/api/bgg", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    if (res.status === 503) throw new Error("BGG_API_TOKEN_MISSING");
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { success: false, games: [], errors: [data.error || `Status ${res.status}`], queued: false };
    }
    return await res.json();
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("BGG_API_TOKEN")) throw error;
    return { success: false, games: [], errors: [String(error)], queued: false };
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
  }

  return games;
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
