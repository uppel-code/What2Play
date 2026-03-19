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

import { searchExpansions, searchExpansionsByName } from "@/services/bgg-client";

const THING_WITH_EXPANSIONS_XML = `<?xml version="1.0" encoding="utf-8"?>
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
    <link type="boardgamecategory" id="1" value="Negotiation"/>
    <link type="boardgameexpansion" id="926" value="Catan: Seafarers"/>
    <link type="boardgameexpansion" id="926926" value="Catan: Cities &amp; Knights"/>
    <link type="boardgamemechanic" id="2" value="Dice Rolling"/>
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

const THING_NO_EXPANSIONS_XML = `<?xml version="1.0" encoding="utf-8"?>
<items>
  <item type="boardgame" id="99">
    <name type="primary" sortindex="1" value="SimpleGame"/>
    <link type="boardgamecategory" id="1" value="Abstract"/>
  </item>
</items>`;

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("searchExpansions", () => {
  it("parses expansion links from BGG thing XML", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      status: 200,
      text: async () => THING_WITH_EXPANSIONS_XML,
    } as Response);

    const results = await searchExpansions(13);
    expect(results).toHaveLength(2);
    // Sorted alphabetically
    expect(results[0].name).toBe("Catan: Cities &amp; Knights");
    expect(results[0].bggId).toBe(926926);
    expect(results[1].name).toBe("Catan: Seafarers");
    expect(results[1].bggId).toBe(926);
  });

  it("returns empty array when no expansion links", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      status: 200,
      text: async () => THING_NO_EXPANSIONS_XML,
    } as Response);

    const results = await searchExpansions(99);
    expect(results).toEqual([]);
  });

  it("returns empty array on non-200 status", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      status: 500,
      text: async () => "error",
    } as Response);

    const results = await searchExpansions(13);
    expect(results).toEqual([]);
  });

  it("throws on 401 (invalid token)", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      status: 401,
      text: async () => "unauthorized",
    } as Response);

    await expect(searchExpansions(13)).rejects.toThrow("BGG_API_TOKEN_INVALID");
  });

  it("returns empty array on network error", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError("Network error"));

    const results = await searchExpansions(13);
    expect(results).toEqual([]);
  });
});

describe("searchExpansionsByName", () => {
  it("searches BGG for game name + expansion", async () => {
    const SEARCH_XML = `<?xml version="1.0" encoding="utf-8"?>
<items total="1">
  <item type="boardgame" id="926">
    <name type="primary" value="Catan: Seafarers"/>
    <yearpublished value="1997"/>
  </item>
</items>`;

    vi.mocked(fetch).mockResolvedValueOnce({
      status: 200,
      text: async () => SEARCH_XML,
    } as Response);

    const results = await searchExpansionsByName("Catan");
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Catan: Seafarers");
    // Verify the search query included "expansion" (URL-encoded with %20)
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("Catan%20expansion"),
      expect.any(Object),
    );
  });
});
