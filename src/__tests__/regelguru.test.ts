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

import { askRuleQuestion } from "@/services/ai-client";
import type { RuleMessage } from "@/services/ai-client";
import { Preferences } from "@capacitor/preferences";

function mockAiConfig(provider: string, apiKey: string) {
  vi.mocked(Preferences.get).mockImplementation(async ({ key }) => {
    if (key === "ai_provider") return { value: provider };
    if (key === "ai_api_key") return { value: apiKey };
    return { value: null };
  });
}

function mockGeminiFetchResponse(text: string) {
  vi.mocked(fetch).mockResolvedValueOnce({
    status: 200,
    text: async () => JSON.stringify({
      candidates: [{ content: { parts: [{ text }] } }],
    }),
  } as Response);
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  mockAiConfig("gemini", "test-key");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("askRuleQuestion", () => {
  it("includes game name in system prompt", async () => {
    mockGeminiFetchResponse("Antwort");

    await askRuleQuestion("Wingspan", ["Engine Building"], "Wie funktioniert das?", []);

    const fetchCall = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(fetchCall[1]!.body as string);
    // Gemini: system prompt is the first user message
    const systemPrompt = body.contents[0].parts[0].text;
    expect(systemPrompt).toContain("Wingspan");
  });

  it("warns about hallucinations in system prompt", async () => {
    mockGeminiFetchResponse("Antwort");

    await askRuleQuestion("Catan", [], "Frage", []);

    const fetchCall = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(fetchCall[1]!.body as string);
    const systemPrompt = body.contents[0].parts[0].text;
    expect(systemPrompt).toContain("ERFINDE KEINE Regeln");
    expect(systemPrompt).toContain("nicht sicher");
  });

  it("includes mechanics in system prompt context", async () => {
    mockGeminiFetchResponse("Antwort");

    await askRuleQuestion("Catan", ["Dice Rolling", "Trading"], "Frage", []);

    const fetchCall = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(fetchCall[1]!.body as string);
    const systemPrompt = body.contents[0].parts[0].text;
    expect(systemPrompt).toContain("Dice Rolling");
    expect(systemPrompt).toContain("Trading");
    expect(systemPrompt).toContain("Mechaniken");
  });

  it("passes history to API (max 5 messages)", async () => {
    mockGeminiFetchResponse("Antwort");

    const history: RuleMessage[] = [
      { role: "user", text: "Frage 1" },
      { role: "assistant", text: "Antwort 1" },
      { role: "user", text: "Frage 2" },
      { role: "assistant", text: "Antwort 2" },
      { role: "user", text: "Frage 3" },
      { role: "assistant", text: "Antwort 3" },
      { role: "user", text: "Frage 4" },
    ];

    await askRuleQuestion("Catan", [], "Neue Frage", history);

    const fetchCall = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(fetchCall[1]!.body as string);
    // Gemini format: system(user) + ack(model) + history + question
    // history.slice(-5) = last 5 messages
    const contents = body.contents;
    // contents[0] = system prompt (user), contents[1] = ack (model)
    // contents[2..6] = last 5 history messages, contents[7] = new question
    expect(contents).toHaveLength(2 + 5 + 1); // system + ack + 5 history + question
    expect(contents[contents.length - 1].parts[0].text).toBe("Neue Frage");
  });

  it("returns trimmed response", async () => {
    mockGeminiFetchResponse("  Antwort mit Spaces  ");

    const result = await askRuleQuestion("Catan", [], "Frage", []);
    expect(result).toBe("Antwort mit Spaces");
  });

  it("throws AI_NOT_CONFIGURED when no config", async () => {
    vi.mocked(Preferences.get).mockResolvedValue({ value: null });

    await expect(askRuleQuestion("Catan", [], "Frage", [])).rejects.toThrow("AI_NOT_CONFIGURED");
  });

  it("works with OpenAI provider", async () => {
    mockAiConfig("openai", "sk-test");
    vi.mocked(fetch).mockResolvedValueOnce({
      status: 200,
      text: async () => JSON.stringify({
        choices: [{ message: { content: "OpenAI Antwort" } }],
      }),
    } as Response);

    const result = await askRuleQuestion("Catan", [], "Frage", []);
    expect(result).toBe("OpenAI Antwort");

    // Verify OpenAI uses system message format
    const fetchCall = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(fetchCall[1]!.body as string);
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[0].content).toContain("Catan");
  });

  it("works with Claude provider", async () => {
    mockAiConfig("claude", "sk-ant-test");
    vi.mocked(fetch).mockResolvedValueOnce({
      status: 200,
      text: async () => JSON.stringify({
        content: [{ text: "Claude Antwort" }],
      }),
    } as Response);

    const result = await askRuleQuestion("Catan", [], "Frage", []);
    expect(result).toBe("Claude Antwort");

    // Verify Claude uses system field
    const fetchCall = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(fetchCall[1]!.body as string);
    expect(body.system).toContain("Catan");
  });

  it("handles empty mechanics gracefully", async () => {
    mockGeminiFetchResponse("Antwort");

    await askRuleQuestion("Catan", [], "Frage", []);

    const fetchCall = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(fetchCall[1]!.body as string);
    const systemPrompt = body.contents[0].parts[0].text;
    expect(systemPrompt).not.toContain("Mechaniken");
  });
});
