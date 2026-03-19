import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Capacitor modules before importing ai-client
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

import { generateQuickRules } from "@/services/ai-client";
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

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  mockAiConfig("gemini", "test-key");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("generateQuickRules", () => {
  it("builds prompt with game name", async () => {
    mockFetchResponse(JSON.stringify({
      candidates: [{ content: { parts: [{ text: "Regeln für 7 Wonders" }] } }],
    }));

    await generateQuickRules("7 Wonders", []);

    const fetchCall = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(fetchCall[1]!.body as string);
    const prompt = body.contents[0].parts[0].text;
    expect(prompt).toContain("7 Wonders");
  });

  it("includes mechanics in prompt", async () => {
    mockFetchResponse(JSON.stringify({
      candidates: [{ content: { parts: [{ text: "Regeln" }] } }],
    }));

    await generateQuickRules("7 Wonders", ["Drafting", "Hand Management"]);

    const fetchCall = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(fetchCall[1]!.body as string);
    const prompt = body.contents[0].parts[0].text;
    expect(prompt).toContain("Drafting");
    expect(prompt).toContain("Hand Management");
    expect(prompt).toContain("Mechaniken");
  });

  it("requests 150-250 words in prompt", async () => {
    mockFetchResponse(JSON.stringify({
      candidates: [{ content: { parts: [{ text: "Regeln" }] } }],
    }));

    await generateQuickRules("Catan", ["Dice Rolling"]);

    const fetchCall = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(fetchCall[1]!.body as string);
    const prompt = body.contents[0].parts[0].text;
    expect(prompt).toContain("150-250");
  });

  it("instructs no greeting in prompt", async () => {
    mockFetchResponse(JSON.stringify({
      candidates: [{ content: { parts: [{ text: "Regeln" }] } }],
    }));

    await generateQuickRules("Catan", []);

    const fetchCall = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(fetchCall[1]!.body as string);
    const prompt = body.contents[0].parts[0].text;
    expect(prompt).toContain("Keine Begrüßung");
  });

  it("returns trimmed response text", async () => {
    mockFetchResponse(JSON.stringify({
      candidates: [{ content: { parts: [{ text: "  Regeln für Catan  " }] } }],
    }));

    const result = await generateQuickRules("Catan", []);
    expect(result).toBe("Regeln für Catan");
  });

  it("throws AI_NOT_CONFIGURED when no config", async () => {
    vi.mocked(Preferences.get).mockResolvedValue({ value: null });

    await expect(generateQuickRules("Catan", [])).rejects.toThrow("AI_NOT_CONFIGURED");
  });

  it("works with OpenAI provider", async () => {
    mockAiConfig("openai", "sk-test");
    mockFetchResponse(JSON.stringify({
      choices: [{ message: { content: "OpenAI Regeln" } }],
    }));

    const result = await generateQuickRules("Catan", []);
    expect(result).toBe("OpenAI Regeln");
  });

  it("works with Claude provider", async () => {
    mockAiConfig("claude", "sk-ant-test");
    mockFetchResponse(JSON.stringify({
      content: [{ text: "Claude Regeln" }],
    }));

    const result = await generateQuickRules("Catan", []);
    expect(result).toBe("Claude Regeln");
  });

  it("throws UNKNOWN_PROVIDER for invalid provider", async () => {
    mockAiConfig("invalid", "key");

    await expect(generateQuickRules("Catan", [])).rejects.toThrow("UNKNOWN_PROVIDER");
  });
});
