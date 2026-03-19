import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  formatRulesText,
  formatRulesHtml,
  exportRulesAsText,
  copyRulesToClipboard,
} from "@/services/rules-export";
import type { Game } from "@/types/game";

const sampleGame = {
  id: 1,
  name: "Catan",
  yearpublished: 1995,
  minPlayers: 3,
  maxPlayers: 4,
  playingTime: 90,
  minPlayTime: 60,
  maxPlayTime: 120,
  minAge: 10,
  averageWeight: 2.3,
  mechanics: ["Dice Rolling", "Trading"],
  categories: [],
  thumbnail: null,
  image: null,
  bggId: 13,
  bggRating: 7.1,
  bggRank: 400,
  quickRules: null,
  owned: true,
  wishlist: false,
  shelfLocation: null,
  lastPlayed: null,
  favorite: true,
  forSale: false,
  notes: null,
  tags: [],
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
} as Game;

const quickRules = "Siedle das Land!\nBaue Straßen und Siedlungen.\nSammle 10 Siegpunkte.";

// ─── formatRulesText ───

describe("formatRulesText", () => {
  it("includes game name in header", () => {
    const text = formatRulesText({ game: sampleGame, quickRules });
    expect(text).toContain("Catan — Kurzregeln");
  });

  it("includes game metadata", () => {
    const text = formatRulesText({ game: sampleGame, quickRules });
    expect(text).toContain("Erscheinungsjahr: 1995");
    expect(text).toContain("Spieler: 3–4");
    expect(text).toContain("Spieldauer: 90 Minuten");
    expect(text).toContain("Komplexität: 2.3 / 5.0");
    expect(text).toContain("Mechaniken: Dice Rolling, Trading");
  });

  it("includes the quickRules content", () => {
    const text = formatRulesText({ game: sampleGame, quickRules });
    expect(text).toContain("Siedle das Land!");
    expect(text).toContain("Baue Straßen und Siedlungen.");
    expect(text).toContain("Sammle 10 Siegpunkte.");
  });

  it("includes footer", () => {
    const text = formatRulesText({ game: sampleGame, quickRules });
    expect(text).toContain("Exportiert aus What2Play");
  });

  it("omits year when null", () => {
    const gameNoYear = { ...sampleGame, yearpublished: null };
    const text = formatRulesText({ game: gameNoYear, quickRules });
    expect(text).not.toContain("Erscheinungsjahr");
  });

  it("omits complexity when zero", () => {
    const gameNoWeight = { ...sampleGame, averageWeight: 0 };
    const text = formatRulesText({ game: gameNoWeight, quickRules });
    expect(text).not.toContain("Komplexität");
  });

  it("omits mechanics when empty", () => {
    const gameNoMechanics = { ...sampleGame, mechanics: [] };
    const text = formatRulesText({ game: gameNoMechanics, quickRules });
    expect(text).not.toContain("Mechaniken");
  });
});

// ─── formatRulesHtml ───

describe("formatRulesHtml", () => {
  it("generates valid HTML with game name", () => {
    const html = formatRulesHtml({ game: sampleGame, quickRules });
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<title>Catan — Kurzregeln</title>");
    expect(html).toContain("Catan");
  });

  it("includes game metadata in HTML", () => {
    const html = formatRulesHtml({ game: sampleGame, quickRules });
    expect(html).toContain("1995");
    expect(html).toContain("3–4 Spieler");
    expect(html).toContain("90 Min");
    expect(html).toContain("2.3/5");
  });

  it("includes rules content in HTML", () => {
    const html = formatRulesHtml({ game: sampleGame, quickRules });
    expect(html).toContain("Siedle das Land!");
    expect(html).toContain("Baue Straßen und Siedlungen.");
  });

  it("escapes HTML special characters", () => {
    const dangerousGame = { ...sampleGame, name: "Test <script>alert(1)</script>" };
    const html = formatRulesHtml({ game: dangerousGame, quickRules: "Rules with <b>bold</b>" });
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;b&gt;bold&lt;/b&gt;");
  });

  it("includes print-ready footer", () => {
    const html = formatRulesHtml({ game: sampleGame, quickRules });
    expect(html).toContain("Exportiert aus What2Play");
    expect(html).toContain("@media print");
  });
});

// ─── exportRulesAsText ───

describe("exportRulesAsText", () => {
  it("creates and clicks a download link", () => {
    const createObjectURL = vi.fn(() => "blob:test");
    const revokeObjectURL = vi.fn();
    const clickSpy = vi.fn();

    Object.defineProperty(global, "URL", {
      value: { createObjectURL, revokeObjectURL },
      writable: true,
    });

    const createElement = vi.spyOn(document, "createElement");
    const appendChild = vi.spyOn(document.body, "appendChild").mockImplementation((node) => node);
    const removeChild = vi.spyOn(document.body, "removeChild").mockImplementation((node) => node);

    // Mock the anchor element
    const fakeAnchor = { href: "", download: "", click: clickSpy } as unknown as HTMLAnchorElement;
    createElement.mockReturnValue(fakeAnchor);

    exportRulesAsText({ game: sampleGame, quickRules });

    expect(createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(fakeAnchor.download).toContain("Catan");
    expect(fakeAnchor.download).toContain(".txt");
    expect(revokeObjectURL).toHaveBeenCalled();

    createElement.mockRestore();
    appendChild.mockRestore();
    removeChild.mockRestore();
  });
});

// ─── copyRulesToClipboard ───

describe("copyRulesToClipboard", () => {
  it("copies text to clipboard and returns true", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });

    const result = await copyRulesToClipboard({ game: sampleGame, quickRules });
    expect(result).toBe(true);
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("Catan"));
  });

  it("returns false when clipboard fails", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.assign(navigator, {
      clipboard: { writeText },
    });

    const result = await copyRulesToClipboard({ game: sampleGame, quickRules });
    expect(result).toBe(false);
  });
});
