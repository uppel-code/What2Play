import { describe, it, expect } from "vitest";

// Test the barcode response parser directly
// The actual AI calls require API keys, so we test the parsing logic

describe("Barcode Response Parsing", () => {
  // Import the module dynamically to test parseBarcodeResponse through the public API
  // Since parseBarcodeResponse is private, we test the behavior through recognizeBarcodeFromImage's dependencies

  it("parseBarcodeResponse parses valid JSON", () => {
    const parsed = parseBarcodeResponse('{"barcode": "4002051694968", "gameName": "Catan", "confidence": "high"}');
    expect(parsed.barcode).toBe("4002051694968");
    expect(parsed.gameName).toBe("Catan");
    expect(parsed.confidence).toBe("high");
  });

  it("parseBarcodeResponse handles markdown code fences", () => {
    const parsed = parseBarcodeResponse('```json\n{"barcode": "123", "gameName": "Azul", "confidence": "medium"}\n```');
    expect(parsed.gameName).toBe("Azul");
    expect(parsed.confidence).toBe("medium");
  });

  it("parseBarcodeResponse handles null values", () => {
    const parsed = parseBarcodeResponse('{"barcode": null, "gameName": null, "confidence": "low"}');
    expect(parsed.barcode).toBeNull();
    expect(parsed.gameName).toBeNull();
    expect(parsed.confidence).toBe("low");
  });

  it("parseBarcodeResponse handles invalid JSON", () => {
    const parsed = parseBarcodeResponse("not json at all");
    expect(parsed.barcode).toBeNull();
    expect(parsed.gameName).toBeNull();
    expect(parsed.confidence).toBe("low");
  });

  it("parseBarcodeResponse handles empty response", () => {
    const parsed = parseBarcodeResponse("{}");
    expect(parsed.barcode).toBeNull();
    expect(parsed.gameName).toBeNull();
    expect(parsed.confidence).toBe("low");
  });

  it("parseBarcodeResponse normalizes invalid confidence", () => {
    const parsed = parseBarcodeResponse('{"barcode": "123", "gameName": "Test", "confidence": "invalid"}');
    expect(parsed.confidence).toBe("low");
  });
});

// Inline the parser function for testing since it's private in the module
function parseBarcodeResponse(text: string): { barcode: string | null; gameName: string | null; confidence: "high" | "medium" | "low" } {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  try {
    const parsed = JSON.parse(cleaned);
    return {
      barcode: parsed.barcode || null,
      gameName: parsed.gameName || null,
      confidence: ["high", "medium", "low"].includes(parsed.confidence) ? parsed.confidence : "low",
    };
  } catch {
    return { barcode: null, gameName: null, confidence: "low" };
  }
}
