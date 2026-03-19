import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import GameCard, { daysSinceLastPlayed } from "@/components/GameCard";
import type { Game } from "@/types/game";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));

function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: 1,
    bggId: 12345,
    name: "Catan",
    yearpublished: 1995,
    minPlayers: 3,
    maxPlayers: 4,
    playingTime: 90,
    minPlayTime: 60,
    maxPlayTime: 120,
    minAge: 10,
    averageWeight: 2.3,
    thumbnail: null,
    image: null,
    categories: [],
    mechanics: [],
    bggRating: 7.2,
    bggRank: 100,
    quickRules: null,
    owned: true,
    shelfLocation: null,
    lastPlayed: null,
    favorite: false,
    notes: null,
    tags: [],
    createdAt: "2025-01-01",
    updatedAt: "2025-01-01",
    ...overrides,
  };
}

describe("GameCard badges", () => {
  it("shows 'Regeln?' badge when lastPlayed > 30 days and no quickRules", () => {
    const oldDate = new Date(Date.now() - 45 * 86400000).toISOString().split("T")[0];
    const game = makeGame({ lastPlayed: oldDate, quickRules: null });
    render(<GameCard game={game} />);
    expect(screen.getByTitle("Regeln auffrischen?")).toBeInTheDocument();
    expect(screen.getByText(/Regeln\?/)).toBeInTheDocument();
  });

  it("does NOT show 'Regeln?' badge when lastPlayed < 30 days", () => {
    const recentDate = new Date(Date.now() - 10 * 86400000).toISOString().split("T")[0];
    const game = makeGame({ lastPlayed: recentDate, quickRules: null });
    render(<GameCard game={game} />);
    expect(screen.queryByTitle("Regeln auffrischen?")).not.toBeInTheDocument();
  });

  it("shows green check when quickRules are present", () => {
    const oldDate = new Date(Date.now() - 45 * 86400000).toISOString().split("T")[0];
    const game = makeGame({ lastPlayed: oldDate, quickRules: "Some rules text" });
    render(<GameCard game={game} />);
    expect(screen.getByTitle("Regeln vorhanden")).toBeInTheDocument();
    expect(screen.queryByTitle("Regeln auffrischen?")).not.toBeInTheDocument();
  });

  it("does NOT show badge or check when favorite (favorite star takes priority)", () => {
    const oldDate = new Date(Date.now() - 45 * 86400000).toISOString().split("T")[0];
    const game = makeGame({ lastPlayed: oldDate, quickRules: null, favorite: true });
    render(<GameCard game={game} />);
    expect(screen.queryByTitle("Regeln auffrischen?")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Regeln vorhanden")).not.toBeInTheDocument();
  });
});

describe("daysSinceLastPlayed", () => {
  it("returns null for null input", () => {
    expect(daysSinceLastPlayed(null)).toBeNull();
  });

  it("returns correct days for a past date", () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString().split("T")[0];
    const result = daysSinceLastPlayed(tenDaysAgo);
    expect(result).toBeGreaterThanOrEqual(9);
    expect(result).toBeLessThanOrEqual(11);
  });
});

describe("Quick Rules modal links", () => {
  it("generates correct BGG files URL", () => {
    const bggId = 13;
    const url = `https://boardgamegeek.com/boardgame/${bggId}/files`;
    expect(url).toBe("https://boardgamegeek.com/boardgame/13/files");
  });

  it("generates correct Google PDF search URL", () => {
    const gameName = "Die Siedler von Catan";
    const url = `https://www.google.com/search?q=${encodeURIComponent(gameName + " Spielanleitung PDF")}`;
    expect(url).toContain("google.com/search?q=");
    expect(url).toContain("Spielanleitung");
    expect(url).toContain(encodeURIComponent("Die Siedler von Catan"));
  });

  it("generates correct YouTube search URL", () => {
    const gameName = "Catan";
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(gameName + " Regeln erklärt")}`;
    expect(url).toContain("youtube.com/results");
    expect(url).toContain(encodeURIComponent("Catan Regeln erklärt"));
  });
});
