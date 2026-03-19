import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Dexie from "dexie";
import {
  createGame,
  createPlaySession,
  createPlayer,
} from "@/lib/db-client";
import type { CreateGameInput } from "@/types/game";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("id=1"),
  usePathname: () => "/leaderboard",
}));

const sampleGame: CreateGameInput = {
  name: "Catan",
  bggId: 13,
  minPlayers: 3,
  maxPlayers: 4,
  playingTime: 90,
  averageWeight: 2.3,
};

beforeEach(async () => {
  await Dexie.delete("What2PlayDB");
});

describe("LeaderboardPage", () => {
  it("renders leaderboard with player data", async () => {
    const game = await createGame(sampleGame);
    const alice = await createPlayer("Alice");
    const bob = await createPlayer("Bob");

    await createPlaySession({ gameId: game.id, playedAt: "2026-01-01", playerCount: 2, duration: 60, winnerId: alice.id });
    await createPlaySession({ gameId: game.id, playedAt: "2026-01-02", playerCount: 2, duration: 60, winnerId: alice.id });
    await createPlaySession({ gameId: game.id, playedAt: "2026-01-03", playerCount: 2, duration: 60, winnerId: bob.id });

    // Dynamic import to avoid module-level issues
    const { default: LeaderboardPage } = await import("@/app/leaderboard/page");
    render(<LeaderboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId("leaderboard-table")).toBeInTheDocument();
    });

    // Alice should be ranked first
    const aliceRow = screen.getByTestId(`leaderboard-row-${alice.id}`);
    expect(aliceRow).toBeInTheDocument();
    expect(aliceRow).toHaveTextContent("Alice");
    expect(aliceRow).toHaveTextContent("2W"); // 2 wins

    const bobRow = screen.getByTestId(`leaderboard-row-${bob.id}`);
    expect(bobRow).toBeInTheDocument();
    expect(bobRow).toHaveTextContent("Bob");
    expect(bobRow).toHaveTextContent("1W"); // 1 win
  });

  it("shows empty state when no sessions exist", async () => {
    const { default: LeaderboardPage } = await import("@/app/leaderboard/page");
    render(<LeaderboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/Noch keine Spiele gespielt/)).toBeInTheDocument();
    });
  });

  it("filters players by search input", async () => {
    const game = await createGame(sampleGame);
    const alice = await createPlayer("Alice");
    const bob = await createPlayer("Bob");

    await createPlaySession({ gameId: game.id, playedAt: "2026-01-01", playerCount: 2, duration: 60, winnerId: alice.id });
    await createPlaySession({ gameId: game.id, playedAt: "2026-01-02", playerCount: 2, duration: 60, winnerId: bob.id });

    const { default: LeaderboardPage } = await import("@/app/leaderboard/page");
    render(<LeaderboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId("leaderboard-table")).toBeInTheDocument();
    });

    // Type in search
    const searchInput = screen.getByTestId("player-search");
    fireEvent.change(searchInput, { target: { value: "alice" } });

    // Only Alice should be visible
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.queryByText("Bob")).not.toBeInTheDocument();
  });

  it("shows my stats card", async () => {
    const game = await createGame(sampleGame);
    const alice = await createPlayer("Alice");

    await createPlaySession({ gameId: game.id, playedAt: "2026-01-01", playerCount: 2, duration: 60, winnerId: alice.id });

    const { default: LeaderboardPage } = await import("@/app/leaderboard/page");
    render(<LeaderboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId("my-stats-card")).toBeInTheDocument();
    });

    // My stats card should show rank and wins
    const statsCard = screen.getByTestId("my-stats-card");
    expect(statsCard).toHaveTextContent("#1");
    expect(statsCard).toHaveTextContent("1"); // 1 win
  });

  it("has sort buttons for wins and winRate", async () => {
    const game = await createGame(sampleGame);
    const alice = await createPlayer("Alice");

    await createPlaySession({ gameId: game.id, playedAt: "2026-01-01", playerCount: 2, duration: 60, winnerId: alice.id });

    const { default: LeaderboardPage } = await import("@/app/leaderboard/page");
    render(<LeaderboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId("sort-wins")).toBeInTheDocument();
    });

    expect(screen.getByTestId("sort-winrate")).toBeInTheDocument();

    // Click winRate sort
    fireEvent.click(screen.getByTestId("sort-winrate"));
    // Should not crash, table should still be visible
    expect(screen.getByTestId("leaderboard-table")).toBeInTheDocument();
  });
});

describe("PlayerPage", () => {
  it("renders player detail with stats", async () => {
    const game = await createGame(sampleGame);
    const alice = await createPlayer("Alice");
    const bob = await createPlayer("Bob");

    await createPlaySession({ gameId: game.id, playedAt: "2026-01-01", playerCount: 2, duration: 60, winnerId: alice.id });
    await createPlaySession({ gameId: game.id, playedAt: "2026-01-02", playerCount: 2, duration: 90, winnerId: alice.id });
    await createPlaySession({ gameId: game.id, playedAt: "2026-01-03", playerCount: 2, duration: 60, winnerId: bob.id });

    const { default: PlayerPage } = await import("@/app/player/page");
    render(<PlayerPage />);

    await waitFor(() => {
      expect(screen.getByTestId("player-hero")).toBeInTheDocument();
    });

    // Should not crash, id=1 is Alice from the mock
    const hero = screen.getByTestId("player-hero");
    expect(hero).toBeInTheDocument();
  });

  it("renders player history section", async () => {
    const game = await createGame(sampleGame);
    const alice = await createPlayer("Alice");

    await createPlaySession({ gameId: game.id, playedAt: "2026-01-01", playerCount: 2, duration: 60, winnerId: alice.id });

    const { default: PlayerPage } = await import("@/app/player/page");
    render(<PlayerPage />);

    await waitFor(() => {
      expect(screen.getByTestId("player-history")).toBeInTheDocument();
    });
  });

  it("shows not found for unknown player id", async () => {
    // Mock returns id=999 which doesn't exist
    vi.doMock("next/navigation", () => ({
      useSearchParams: () => new URLSearchParams("id=999"),
      usePathname: () => "/player",
    }));

    // Need to reimport to get the new mock
    vi.resetModules();
    const { default: PlayerPage } = await import("@/app/player/page");
    render(<PlayerPage />);

    await waitFor(() => {
      expect(screen.getByText(/Spieler nicht gefunden/)).toBeInTheDocument();
    });

    // Restore mock for other tests
    vi.doMock("next/navigation", () => ({
      useSearchParams: () => new URLSearchParams("id=1"),
      usePathname: () => "/leaderboard",
    }));
    vi.resetModules();
  });
});
