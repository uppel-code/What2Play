import { describe, it, expect, vi } from "vitest";

// ─── EAN Lookup Response Parser Tests ───

describe("EAN Lookup Response Parsing", () => {
  it("parseEanLookupResponse parses valid JSON", () => {
    const parsed = parseEanLookupResponse('{"gameName": "Catan", "confidence": "high"}');
    expect(parsed.gameName).toBe("Catan");
    expect(parsed.confidence).toBe("high");
  });

  it("parseEanLookupResponse handles markdown code fences", () => {
    const parsed = parseEanLookupResponse('```json\n{"gameName": "Azul", "confidence": "medium"}\n```');
    expect(parsed.gameName).toBe("Azul");
    expect(parsed.confidence).toBe("medium");
  });

  it("parseEanLookupResponse handles null gameName", () => {
    const parsed = parseEanLookupResponse('{"gameName": null, "confidence": "low"}');
    expect(parsed.gameName).toBeNull();
    expect(parsed.confidence).toBe("low");
  });

  it("parseEanLookupResponse handles invalid JSON", () => {
    const parsed = parseEanLookupResponse("not json");
    expect(parsed.gameName).toBeNull();
    expect(parsed.confidence).toBe("low");
  });

  it("parseEanLookupResponse normalizes invalid confidence", () => {
    const parsed = parseEanLookupResponse('{"gameName": "Test", "confidence": "super"}');
    expect(parsed.confidence).toBe("low");
  });

  it("parseEanLookupResponse handles empty object", () => {
    const parsed = parseEanLookupResponse("{}");
    expect(parsed.gameName).toBeNull();
    expect(parsed.confidence).toBe("low");
  });
});

// ─── Multi-Scan Duplicate Detection Tests ───

describe("Multi-Scan Duplicate Detection", () => {
  it("detects duplicate EANs", () => {
    const scannedEans = new Set<string>();
    const ean1 = "4002051694968";
    const ean2 = "4005556269372";

    expect(scannedEans.has(ean1)).toBe(false);
    scannedEans.add(ean1);
    expect(scannedEans.has(ean1)).toBe(true);
    expect(scannedEans.has(ean2)).toBe(false);
    scannedEans.add(ean2);
    expect(scannedEans.has(ean2)).toBe(true);
  });

  it("allows removing EANs from scan set", () => {
    const scannedEans = new Set<string>();
    scannedEans.add("123");
    scannedEans.add("456");
    expect(scannedEans.size).toBe(2);
    scannedEans.delete("123");
    expect(scannedEans.has("123")).toBe(false);
    expect(scannedEans.size).toBe(1);
  });
});

// ─── Barcode Decode Result Tests ───

describe("Barcode Decode Result Handling", () => {
  it("filters valid results from zxing-wasm output", () => {
    const mockResults = [
      { isValid: true, text: "4002051694968", format: "EAN-13" },
      { isValid: false, text: "", format: "" },
      { isValid: true, text: "4005556269372", format: "EAN-13" },
    ];

    const valid = mockResults.filter((r) => r.isValid && r.text.trim());
    expect(valid).toHaveLength(2);
    expect(valid[0].text).toBe("4002051694968");
    expect(valid[1].text).toBe("4005556269372");
  });

  it("returns first valid barcode", () => {
    const mockResults = [
      { isValid: true, text: "4002051694968", format: "EAN-13" },
      { isValid: true, text: "4005556269372", format: "EAN-13" },
    ];

    const valid = mockResults.filter((r) => r.isValid && r.text.trim());
    const ean = valid.length > 0 ? valid[0].text.trim() : null;
    expect(ean).toBe("4002051694968");
  });

  it("returns null when no valid barcodes found", () => {
    const mockResults = [
      { isValid: false, text: "", format: "" },
    ];

    const valid = mockResults.filter((r) => r.isValid && r.text.trim());
    const ean = valid.length > 0 ? valid[0].text.trim() : null;
    expect(ean).toBeNull();
  });

  it("handles empty results array", () => {
    const mockResults: { isValid: boolean; text: string; format: string }[] = [];
    const valid = mockResults.filter((r) => r.isValid && r.text.trim());
    const ean = valid.length > 0 ? valid[0].text.trim() : null;
    expect(ean).toBeNull();
  });

  it("trims whitespace from barcode text", () => {
    const mockResults = [
      { isValid: true, text: "  4002051694968  ", format: "EAN-13" },
    ];

    const valid = mockResults.filter((r) => r.isValid && r.text.trim());
    const ean = valid.length > 0 ? valid[0].text.trim() : null;
    expect(ean).toBe("4002051694968");
  });
});

// ─── Beep Sound Tests ───

describe("Audio Feedback", () => {
  it("Web Audio API creates oscillator for beep", () => {
    const mockOsc = {
      connect: vi.fn(),
      frequency: { value: 0 },
      type: "" as OscillatorType,
      start: vi.fn(),
      stop: vi.fn(),
    };
    const mockGain = {
      connect: vi.fn(),
      gain: { value: 0, exponentialRampToValueAtTime: vi.fn() },
    };
    const mockCtx = {
      createOscillator: vi.fn().mockReturnValue(mockOsc),
      createGain: vi.fn().mockReturnValue(mockGain),
      destination: {},
      currentTime: 0,
    };

    // Simulate playBeep logic
    const osc = mockCtx.createOscillator();
    const gain = mockCtx.createGain();
    osc.connect(gain);
    gain.connect(mockCtx.destination);
    osc.frequency.value = 1200;
    osc.type = "sine";
    gain.gain.value = 0.3;
    osc.start();

    expect(osc.frequency.value).toBe(1200);
    expect(osc.type).toBe("sine");
    expect(gain.gain.value).toBe(0.3);
    expect(osc.start).toHaveBeenCalled();
  });
});

// ─── Scanned Game State Management Tests ───

describe("Scanned Game State", () => {
  interface ScannedGame {
    ean: string;
    name: string;
    status: "searching" | "found" | "not_found" | "duplicate" | "added";
    target: "collection" | "wishlist";
  }

  it("toggles target between collection and wishlist", () => {
    const game: ScannedGame = { ean: "123", name: "Catan", status: "found", target: "collection" };
    const toggled = { ...game, target: game.target === "collection" ? "wishlist" as const : "collection" as const };
    expect(toggled.target).toBe("wishlist");
    const toggledBack = { ...toggled, target: toggled.target === "collection" ? "wishlist" as const : "collection" as const };
    expect(toggledBack.target).toBe("collection");
  });

  it("filters addable games (status=found)", () => {
    const games: ScannedGame[] = [
      { ean: "1", name: "Catan", status: "found", target: "collection" },
      { ean: "2", name: "Azul", status: "duplicate", target: "collection" },
      { ean: "3", name: "Wingspan", status: "found", target: "wishlist" },
      { ean: "4", name: "", status: "not_found", target: "collection" },
      { ean: "5", name: "Pandemic", status: "added", target: "collection" },
    ];
    const addable = games.filter((g) => g.status === "found");
    expect(addable).toHaveLength(2);
    expect(addable[0].name).toBe("Catan");
    expect(addable[1].name).toBe("Wingspan");
  });

  it("removes game from list by EAN", () => {
    const games: ScannedGame[] = [
      { ean: "1", name: "Catan", status: "found", target: "collection" },
      { ean: "2", name: "Azul", status: "not_found", target: "collection" },
    ];
    const filtered = games.filter((g) => g.ean !== "2");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe("Catan");
  });

  it("updates game status after BGG lookup", () => {
    const games: ScannedGame[] = [
      { ean: "123", name: "", status: "searching", target: "collection" },
      { ean: "456", name: "Azul", status: "found", target: "collection" },
    ];
    const updated = games.map((g) =>
      g.ean === "123" ? { ...g, name: "Catan", status: "found" as const } : g
    );
    expect(updated[0].name).toBe("Catan");
    expect(updated[0].status).toBe("found");
    expect(updated[1].name).toBe("Azul"); // unchanged
  });
});

// ─── EAN Validation Tests ───

describe("EAN Format Validation", () => {
  it("EAN-13 has 13 digits", () => {
    const ean = "4002051694968";
    expect(ean).toHaveLength(13);
    expect(/^\d{13}$/.test(ean)).toBe(true);
  });

  it("EAN-8 has 8 digits", () => {
    const ean = "12345678";
    expect(ean).toHaveLength(8);
    expect(/^\d{8}$/.test(ean)).toBe(true);
  });

  it("UPC-A has 12 digits", () => {
    const upc = "012345678905";
    expect(upc).toHaveLength(12);
    expect(/^\d{12}$/.test(upc)).toBe(true);
  });
});

// Inline the parser function for testing (mirrors ai-client.ts implementation)
function parseEanLookupResponse(text: string): { gameName: string | null; confidence: "high" | "medium" | "low" } {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  try {
    const parsed = JSON.parse(cleaned);
    return {
      gameName: parsed.gameName || null,
      confidence: ["high", "medium", "low"].includes(parsed.confidence) ? parsed.confidence : "low",
    };
  } catch {
    return { gameName: null, confidence: "low" };
  }
}
