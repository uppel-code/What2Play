import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Capacitor before importing bgg-client
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => false },
  CapacitorHttp: { request: vi.fn() },
}));
vi.mock("@capacitor/preferences", () => ({
  Preferences: {
    get: vi.fn().mockResolvedValue({ value: null }),
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

import { searchBgg, fetchBggThing, fetchBggCollection } from "@/services/bgg-client";

const SEARCH_XML = `<?xml version="1.0" encoding="utf-8"?>
<items total="2">
  <item type="boardgame" id="13">
    <name type="primary" value="Catan"/>
    <yearpublished value="1995"/>
  </item>
  <item type="boardgame" id="27710">
    <name type="primary" value="Catan: 5-6 Player Extension"/>
    <yearpublished value="1996"/>
  </item>
</items>`;

const THING_XML = `<?xml version="1.0" encoding="utf-8"?>
<items>
  <item type="boardgame" id="13">
    <name type="primary" sortindex="1" value="Catan"/>
    <yearpublished value="1995"/>
    <minplayers value="3"/>
    <maxplayers value="4"/>
    <playingtime value="90"/>
    <minplaytime value="60"/>
    <maxplaytime value="120"/>
    <minage value="10"/>
    <thumbnail>https://example.com/thumb.jpg</thumbnail>
    <image>https://example.com/img.jpg</image>
    <link type="boardgamecategory" id="1" value="Negotiation"/>
    <link type="boardgamemechanic" id="2" value="Dice Rolling"/>
    <link type="boardgamemechanic" id="3" value="Trading"/>
    <statistics>
      <ratings>
        <average value="7.15"/>
        <averageweight value="2.32"/>
        <ranks>
          <rank type="subtype" id="1" name="boardgame" value="400"/>
        </ranks>
      </ratings>
    </statistics>
  </item>
</items>`;

const COLLECTION_XML = `<?xml version="1.0" encoding="utf-8"?>
<items totalitems="1">
  <item objecttype="thing" objectid="13" subtype="boardgame">
    <name>Catan</name>
    <yearpublished>1995</yearpublished>
    <thumbnail>https://example.com/thumb.jpg</thumbnail>
    <image>https://example.com/img.jpg</image>
    <stats minplayers="3" maxplayers="4" playingtime="90" minplaytime="60" maxplaytime="120">
      <rating>
        <average value="7.15"/>
        <averageweight value="2.32"/>
        <ranks>
          <rank type="subtype" id="1" name="boardgame" value="400"/>
        </ranks>
      </rating>
    </stats>
  </item>
</items>`;

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("bgg-client", () => {
  // ── searchBgg ──

  describe("searchBgg", () => {
    it("parses search results from XML", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 200,
        text: async () => SEARCH_XML,
      } as Response);

      const results = await searchBgg("Catan");
      expect(results).toHaveLength(2);
      // Sorted by year descending
      expect(results[0].name).toBe("Catan: 5-6 Player Extension");
      expect(results[0].bggId).toBe(27710);
      expect(results[0].yearpublished).toBe(1996);
      expect(results[1].name).toBe("Catan");
      expect(results[1].yearpublished).toBe(1995);
    });

    it("returns empty array on non-200 status", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 500,
        text: async () => "error",
      } as Response);

      const results = await searchBgg("Catan");
      expect(results).toEqual([]);
    });

    it("throws on 401 (invalid token)", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 401,
        text: async () => "unauthorized",
      } as Response);

      await expect(searchBgg("Catan")).rejects.toThrow("BGG_API_TOKEN_INVALID");
    });

    it("returns empty array on network error", async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new TypeError("Network error"));

      const results = await searchBgg("Catan");
      expect(results).toEqual([]);
    });
  });

  // ── fetchBggThing ──

  describe("fetchBggThing", () => {
    it("parses game details from XML", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 200,
        text: async () => THING_XML,
      } as Response);

      const game = await fetchBggThing(13);
      expect(game).not.toBeNull();
      expect(game!.bggId).toBe(13);
      expect(game!.name).toBe("Catan");
      expect(game!.minPlayers).toBe(3);
      expect(game!.maxPlayers).toBe(4);
      expect(game!.playingTime).toBe(90);
      expect(game!.minPlayTime).toBe(60);
      expect(game!.maxPlayTime).toBe(120);
      expect(game!.minAge).toBe(10);
      expect(game!.averageWeight).toBe(2.32);
      expect(game!.thumbnail).toBe("https://example.com/thumb.jpg");
      expect(game!.image).toBe("https://example.com/img.jpg");
      expect(game!.categories).toEqual(["Negotiation"]);
      expect(game!.mechanics).toEqual(["Dice Rolling", "Trading"]);
      expect(game!.bggRating).toBe(7.2); // rounded to 1 decimal
      expect(game!.bggRank).toBe(400);
    });

    it("returns null on non-200 status", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 404,
        text: async () => "not found",
      } as Response);

      const game = await fetchBggThing(99999);
      expect(game).toBeNull();
    });

    it("throws on 401", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 401,
        text: async () => "unauthorized",
      } as Response);

      await expect(fetchBggThing(13)).rejects.toThrow("BGG_API_TOKEN_INVALID");
    });

    it("returns null on network error", async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new TypeError("Network error"));

      const game = await fetchBggThing(13);
      expect(game).toBeNull();
    });
  });

  // ── fetchBggCollection ──

  describe("fetchBggCollection", () => {
    it("parses collection from XML", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 200,
        text: async () => COLLECTION_XML,
      } as Response);

      const result = await fetchBggCollection("testuser");
      expect(result.success).toBe(true);
      expect(result.games).toHaveLength(1);
      expect(result.games[0].bggId).toBe(13);
      expect(result.games[0].name).toBe("Catan");
      expect(result.queued).toBe(false);
    });

    it("returns queued when 202", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 202,
        text: async () => "",
      } as Response);

      const result = await fetchBggCollection("testuser");
      expect(result.queued).toBe(true);
      expect(result.success).toBe(false);
    });

    it("returns error on 401", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 401,
        text: async () => "unauthorized",
      } as Response);

      const result = await fetchBggCollection("testuser");
      expect(result.success).toBe(false);
      expect(result.errors).toContain("BGG_API_TOKEN_INVALID");
    });
  });
});
