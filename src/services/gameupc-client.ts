/**
 * GameUPC API Client
 *
 * Free barcode-to-BGG lookup service for board games.
 * API docs: https://gameupc.com/gameupc-oas.yaml
 *
 * Uses the test endpoint with the public test key.
 * For production, replace with your own API key.
 */

import { Capacitor, CapacitorHttp } from "@capacitor/core";

const GAMEUPC_BASE = "https://api.gameupc.com/test";
const GAMEUPC_API_KEY = "test_test_test_test_test";

// ─── Types ───

export interface GameUpcResult {
  upc: string;
  name: string;
  searched_for: string;
  bgg_info_status: "verified" | "choose_from_bgg_info_or_search";
  bgg_info: GameUpcBggInfo[];
}

export interface GameUpcBggInfo {
  id: number;
  name: string;
  published: string;
  confidence: number;
  thumbnail_url: string;
  image_url: string;
  page_url: string;
  data_url: string;
}

// ─── Lookup ───

/**
 * Look up a board game by EAN/UPC barcode using GameUPC.
 * Returns the best BGG match (highest confidence), or null if not found.
 */
export async function lookupGameUpc(ean: string): Promise<{ bggId: number; name: string; confidence: number } | null> {
  try {
    const url = `${GAMEUPC_BASE}/upc/${encodeURIComponent(ean)}?search_mode=speed`;
    const headers: Record<string, string> = { "x-api-key": GAMEUPC_API_KEY };

    let data: GameUpcResult;

    if (Capacitor.isNativePlatform()) {
      const response = await CapacitorHttp.request({ url, method: "GET", headers });
      if (response.status !== 200) return null;
      data = typeof response.data === "string" ? JSON.parse(response.data) : response.data;
    } else {
      const response = await fetch(url, { headers });
      if (!response.ok) return null;
      data = await response.json();
    }

    if (!data.bgg_info || data.bgg_info.length === 0) return null;

    // Pick the result with highest confidence
    const best = data.bgg_info.reduce((a, b) => (b.confidence > a.confidence ? b : a));

    return {
      bggId: best.id,
      name: best.name,
      confidence: best.confidence,
    };
  } catch {
    return null;
  }
}
