import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Dexie from "dexie";

// Mock Capacitor modules before importing
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => false },
  CapacitorHttp: { request: vi.fn() },
}));
vi.mock("@capacitor/preferences", () => ({
  Preferences: {
    get: vi.fn(),
    set: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  },
}));

import { generateSaleText } from "@/services/ai-client";
import { createGame, updateGame, getGameById } from "@/lib/db-client";
import { Preferences } from "@capacitor/preferences";

function mockAiConfig(provider: string, apiKey: string) {
  vi.mocked(Preferences.get).mockImplementation(async ({ key }) => {
    if (key === "ai_provider") return { value: provider };
    if (key === "ai_api_key") return { value: apiKey };
    return { value: null };
  });
}

function mockFetchResponse(text: string) {
  vi.mocked(fetch).mockResolvedValueOnce({
    status: 200,
    text: async () => text,
  } as Response);
}

beforeEach(async () => {
  await Dexie.delete("What2PlayDB");
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("generateSaleText", () => {
  it("builds prompt with game name and condition", async () => {
    mockAiConfig("gemini", "test-key");
    mockFetchResponse(JSON.stringify({
      candidates: [{ content: { parts: [{ text: '{"text": "Verkaufe Catan", "suggestedPrice": "25"}' }] } }],
    }));

    await generateSaleText("Catan", "Wie neu", ["OVP"], "3–4", 90);

    const fetchCall = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(fetchCall[1]!.body as string);
    const prompt = body.contents[0].parts[0].text;
    expect(prompt).toContain("Catan");
    expect(prompt).toContain("Wie neu");
    expect(prompt).toContain("OVP");
    expect(prompt).toContain("3–4");
    expect(prompt).toContain("90");
  });

  it("includes extras in prompt", async () => {
    mockAiConfig("gemini", "test-key");
    mockFetchResponse(JSON.stringify({
      candidates: [{ content: { parts: [{ text: '{"text": "Text", "suggestedPrice": "30"}' }] } }],
    }));

    await generateSaleText("Wingspan", "Gut", ["Sleeves", "Vollständig"], "1–5", 60);

    const fetchCall = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(fetchCall[1]!.body as string);
    const prompt = body.contents[0].parts[0].text;
    expect(prompt).toContain("Sleeves");
    expect(prompt).toContain("Vollständig");
  });

  it("returns parsed sale text and price", async () => {
    mockAiConfig("gemini", "test-key");
    mockFetchResponse(JSON.stringify({
      candidates: [{ content: { parts: [{ text: '{"text": "Tolles Spiel zu verkaufen!", "suggestedPrice": "35"}' }] } }],
    }));

    const result = await generateSaleText("Azul", "Gut", [], "2–4", 45);
    expect(result.text).toBe("Tolles Spiel zu verkaufen!");
    expect(result.suggestedPrice).toBe("35");
  });

  it("throws AI_NOT_CONFIGURED when no config", async () => {
    vi.mocked(Preferences.get).mockResolvedValue({ value: null });

    await expect(generateSaleText("Catan", "Gut", [], "3–4", 90)).rejects.toThrow("AI_NOT_CONFIGURED");
  });

  it("handles non-JSON response gracefully", async () => {
    mockAiConfig("gemini", "test-key");
    mockFetchResponse(JSON.stringify({
      candidates: [{ content: { parts: [{ text: "Einfacher Text ohne JSON" }] } }],
    }));

    const result = await generateSaleText("Catan", "Gut", [], "3–4", 90);
    expect(result.text).toBe("Einfacher Text ohne JSON");
    expect(result.suggestedPrice).toBe("?");
  });

  it("requests max 100 words and hashtags in prompt", async () => {
    mockAiConfig("gemini", "test-key");
    mockFetchResponse(JSON.stringify({
      candidates: [{ content: { parts: [{ text: '{"text": "Text", "suggestedPrice": "20"}' }] } }],
    }));

    await generateSaleText("Catan", "Gut", [], "3–4", 90);

    const fetchCall = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(fetchCall[1]!.body as string);
    const prompt = body.contents[0].parts[0].text;
    expect(prompt).toContain("max 100 Wörter");
    expect(prompt).toContain("Hashtags");
  });
});

describe("forSale flag in DB", () => {
  it("creates game with forSale=false by default", async () => {
    const game = await createGame({
      name: "Catan",
      minPlayers: 3,
      maxPlayers: 4,
      playingTime: 90,
    });
    expect(game.forSale).toBe(false);
  });

  it("toggles forSale flag via updateGame", async () => {
    const game = await createGame({
      name: "Catan",
      minPlayers: 3,
      maxPlayers: 4,
      playingTime: 90,
    });
    expect(game.forSale).toBe(false);

    const updated = await updateGame(game.id, { forSale: true });
    expect(updated?.forSale).toBe(true);

    const fetched = await getGameById(game.id);
    expect(fetched?.forSale).toBe(true);

    const toggledBack = await updateGame(game.id, { forSale: false });
    expect(toggledBack?.forSale).toBe(false);
  });

  it("can create game with forSale=true", async () => {
    const game = await createGame({
      name: "Azul",
      minPlayers: 2,
      maxPlayers: 4,
      playingTime: 45,
      forSale: true,
    });
    expect(game.forSale).toBe(true);
  });
});

describe("clipboard copy", () => {
  it("copies sale text to clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });

    const saleText = "Tolles Spiel!";
    const price = "25";
    const fullText = `${saleText}\n\nPreisvorschlag: ca. ${price} €`;

    await navigator.clipboard.writeText(fullText);

    expect(writeText).toHaveBeenCalledWith(fullText);
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("Preisvorschlag"));
  });
});
