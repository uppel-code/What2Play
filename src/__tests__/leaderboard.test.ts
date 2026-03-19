import { describe, it, expect, beforeEach } from "vitest";
import Dexie from "dexie";
import {
  createGame,
  createPlaySession,
  createPlayer,
  getAllGames,
  getAllSessions,
  getAllPlayers,
} from "@/lib/db-client";
import {
  computeLeaderboard,
  computeMyStats,
  computeBestStreak,
  computePlayerDetailStats,
} from "@/services/leaderboard";
import type { Game, PlaySession, Player, CreateGameInput } from "@/types/game";

const sampleGame: CreateGameInput = {
  name: "Catan",
  bggId: 13,
  minPlayers: 3,
  maxPlayers: 4,
  playingTime: 90,
  averageWeight: 2.3,
  mechanics: ["Dice Rolling", "Trading"],
};

beforeEach(async () => {
  await Dexie.delete("What2PlayDB");
});

// ─── computeLeaderboard ───

describe("computeLeaderboard", () => {
  it("returns empty array for no players", () => {
    const result = computeLeaderboard([], [], []);
    expect(result).toEqual([]);
  });

  it("returns empty array for no sessions", () => {
    const players: Player[] = [{ id: 1, name: "Alice" }];
    const result = computeLeaderboard([], [], players);
    expect(result).toEqual([]);
  });

  it("ranks players by wins descending", () => {
    const players: Player[] = [
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
      { id: 3, name: "Charlie" },
    ];
    const sessions = [
      { id: 1, gameId: 1, playedAt: "2026-01-01", playerCount: 3, duration: 60, winnerId: 1, notes: null, createdAt: "" },
      { id: 2, gameId: 1, playedAt: "2026-01-02", playerCount: 3, duration: 60, winnerId: 1, notes: null, createdAt: "" },
      { id: 3, gameId: 1, playedAt: "2026-01-03", playerCount: 3, duration: 60, winnerId: 2, notes: null, createdAt: "" },
      { id: 4, gameId: 1, playedAt: "2026-01-04", playerCount: 3, duration: 60, winnerId: 1, notes: null, createdAt: "" },
    ] as PlaySession[];
    const games = [{ id: 1, name: "Catan" } as Game];

    const result = computeLeaderboard(sessions, games, players);
    expect(result.length).toBe(3);
    expect(result[0].player.name).toBe("Alice");
    expect(result[0].wins).toBe(3);
    expect(result[0].rank).toBe(1);
    expect(result[1].player.name).toBe("Bob");
    expect(result[1].wins).toBe(1);
    expect(result[1].rank).toBe(2);
    expect(result[2].player.name).toBe("Charlie");
    expect(result[2].wins).toBe(0);
    expect(result[2].rank).toBe(3);
  });

  it("assigns same rank for tied players", () => {
    const players: Player[] = [
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ];
    const sessions = [
      { id: 1, gameId: 1, playedAt: "2026-01-01", playerCount: 2, duration: 60, winnerId: 1, notes: null, createdAt: "" },
      { id: 2, gameId: 1, playedAt: "2026-01-02", playerCount: 2, duration: 60, winnerId: 2, notes: null, createdAt: "" },
    ] as PlaySession[];
    const games = [{ id: 1, name: "Catan" } as Game];

    const result = computeLeaderboard(sessions, games, players);
    expect(result[0].rank).toBe(1);
    expect(result[1].rank).toBe(1); // tie
  });

  it("computes winRate correctly", () => {
    const players: Player[] = [{ id: 1, name: "Alice" }];
    const sessions = [
      { id: 1, gameId: 1, playedAt: "2026-01-01", playerCount: 2, duration: 60, winnerId: 1, notes: null, createdAt: "" },
      { id: 2, gameId: 1, playedAt: "2026-01-02", playerCount: 2, duration: 60, winnerId: null, notes: null, createdAt: "" },
      { id: 3, gameId: 1, playedAt: "2026-01-03", playerCount: 2, duration: 60, winnerId: null, notes: null, createdAt: "" },
      { id: 4, gameId: 1, playedAt: "2026-01-04", playerCount: 2, duration: 60, winnerId: 1, notes: null, createdAt: "" },
    ] as PlaySession[];
    const games = [{ id: 1, name: "Catan" } as Game];

    const result = computeLeaderboard(sessions, games, players);
    expect(result[0].winRate).toBe(50); // 2/4 = 50%
  });

  it("computes losses correctly", () => {
    const players: Player[] = [
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ];
    const sessions = [
      { id: 1, gameId: 1, playedAt: "2026-01-01", playerCount: 2, duration: 60, winnerId: 1, notes: null, createdAt: "" },
      { id: 2, gameId: 1, playedAt: "2026-01-02", playerCount: 2, duration: 60, winnerId: 2, notes: null, createdAt: "" },
      { id: 3, gameId: 1, playedAt: "2026-01-03", playerCount: 2, duration: 60, winnerId: 1, notes: null, createdAt: "" },
    ] as PlaySession[];
    const games = [{ id: 1, name: "Catan" } as Game];

    const result = computeLeaderboard(sessions, games, players);
    const alice = result.find((e) => e.player.name === "Alice")!;
    expect(alice.wins).toBe(2);
    expect(alice.losses).toBe(1); // Bob won once

    const bob = result.find((e) => e.player.name === "Bob")!;
    expect(bob.wins).toBe(1);
    expect(bob.losses).toBe(2); // Alice won twice
  });

  it("finds favorite game for each player", () => {
    const players: Player[] = [{ id: 1, name: "Alice" }];
    const games = [
      { id: 1, name: "Catan" } as Game,
      { id: 2, name: "Azul" } as Game,
    ];
    const sessions = [
      { id: 1, gameId: 1, playedAt: "2026-01-01", playerCount: 2, duration: 60, winnerId: 1, notes: null, createdAt: "" },
      { id: 2, gameId: 1, playedAt: "2026-01-02", playerCount: 2, duration: 60, winnerId: 1, notes: null, createdAt: "" },
      { id: 3, gameId: 2, playedAt: "2026-01-03", playerCount: 2, duration: 60, winnerId: 1, notes: null, createdAt: "" },
    ] as PlaySession[];

    const result = computeLeaderboard(sessions, games, players);
    expect(result[0].favoriteGame).not.toBeNull();
    expect(result[0].favoriteGame!.game.name).toBe("Catan");
    expect(result[0].favoriteGame!.count).toBe(2);
  });
});

// ─── computeBestStreak ───

describe("computeBestStreak", () => {
  it("returns 0 for no sessions", () => {
    expect(computeBestStreak(1, [])).toBe(0);
  });

  it("counts consecutive wins", () => {
    const sessions = [
      { id: 1, gameId: 1, playedAt: "2026-01-01", winnerId: 1 },
      { id: 2, gameId: 1, playedAt: "2026-01-02", winnerId: 1 },
      { id: 3, gameId: 1, playedAt: "2026-01-03", winnerId: 1 },
      { id: 4, gameId: 1, playedAt: "2026-01-04", winnerId: 2 },
      { id: 5, gameId: 1, playedAt: "2026-01-05", winnerId: 1 },
    ] as PlaySession[];

    expect(computeBestStreak(1, sessions)).toBe(3);
  });

  it("null winnerId does not break streak", () => {
    const sessions = [
      { id: 1, gameId: 1, playedAt: "2026-01-01", winnerId: 1 },
      { id: 2, gameId: 1, playedAt: "2026-01-02", winnerId: null },
      { id: 3, gameId: 1, playedAt: "2026-01-03", winnerId: 1 },
    ] as PlaySession[];

    expect(computeBestStreak(1, sessions)).toBe(2);
  });

  it("returns 1 for single win", () => {
    const sessions = [
      { id: 1, gameId: 1, playedAt: "2026-01-01", winnerId: 1 },
      { id: 2, gameId: 1, playedAt: "2026-01-02", winnerId: 2 },
    ] as PlaySession[];

    expect(computeBestStreak(1, sessions)).toBe(1);
  });
});

// ─── computeMyStats ───

describe("computeMyStats", () => {
  it("returns zero stats for unknown player", () => {
    const result = computeMyStats(999, [], []);
    expect(result.rank).toBe(0);
    expect(result.wins).toBe(0);
    expect(result.winRate).toBe(0);
    expect(result.bestStreak).toBe(0);
  });

  it("returns correct stats for known player", () => {
    const players: Player[] = [
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ];
    const sessions = [
      { id: 1, gameId: 1, playedAt: "2026-01-01", playerCount: 2, duration: 60, winnerId: 1, notes: null, createdAt: "" },
      { id: 2, gameId: 1, playedAt: "2026-01-02", playerCount: 2, duration: 60, winnerId: 1, notes: null, createdAt: "" },
      { id: 3, gameId: 1, playedAt: "2026-01-03", playerCount: 2, duration: 60, winnerId: 2, notes: null, createdAt: "" },
    ] as PlaySession[];
    const games = [{ id: 1, name: "Catan" } as Game];

    const leaderboard = computeLeaderboard(sessions, games, players);
    const myStats = computeMyStats(1, sessions, leaderboard);

    expect(myStats.rank).toBe(1);
    expect(myStats.wins).toBe(2);
    expect(myStats.winRate).toBe(67); // 2/3 ≈ 67%
    expect(myStats.bestStreak).toBe(2);
  });
});

// ─── computePlayerDetailStats ───

describe("computePlayerDetailStats", () => {
  it("computes detailed stats for a player", () => {
    const players: Player[] = [
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ];
    const games = [
      { id: 1, name: "Catan" } as Game,
      { id: 2, name: "Azul" } as Game,
    ];
    const sessions = [
      { id: 1, gameId: 1, playedAt: "2026-01-01", playerCount: 2, duration: 60, winnerId: 1, notes: null, createdAt: "" },
      { id: 2, gameId: 1, playedAt: "2026-01-02", playerCount: 2, duration: 90, winnerId: 1, notes: null, createdAt: "" },
      { id: 3, gameId: 2, playedAt: "2026-01-03", playerCount: 2, duration: 45, winnerId: 2, notes: null, createdAt: "" },
      { id: 4, gameId: 1, playedAt: "2026-01-04", playerCount: 2, duration: 60, winnerId: 2, notes: null, createdAt: "" },
    ] as PlaySession[];

    const stats = computePlayerDetailStats(players[0], sessions, games, players);

    expect(stats.player.name).toBe("Alice");
    expect(stats.wins).toBe(2);
    expect(stats.losses).toBe(2);
    expect(stats.winRate).toBe(50);
    expect(stats.totalSessions).toBe(4);
    expect(stats.bestStreak).toBe(2);
    expect(stats.rank).toBe(1); // Alice has 2 wins, same as Bob but listed first

    // Wins by game
    expect(stats.winsByGame.length).toBe(2);
    const catanWins = stats.winsByGame.find((w) => w.game.name === "Catan")!;
    expect(catanWins.wins).toBe(2);
    expect(catanWins.total).toBe(3);

    // Recent sessions (sorted newest first)
    expect(stats.recentSessions.length).toBe(4);
    expect(stats.recentSessions[0].session.playedAt).toBe("2026-01-04");
    expect(stats.recentSessions[0].won).toBe(false);
  });

  it("limits recent sessions to 10", () => {
    const players: Player[] = [{ id: 1, name: "Alice" }];
    const games = [{ id: 1, name: "Catan" } as Game];
    const sessions: PlaySession[] = [];
    for (let i = 1; i <= 15; i++) {
      sessions.push({
        id: i,
        gameId: 1,
        playedAt: `2026-01-${String(i).padStart(2, "0")}`,
        playerCount: 2,
        duration: 60,
        winnerId: 1,
        notes: null,
        createdAt: "",
      } as PlaySession);
    }

    const stats = computePlayerDetailStats(players[0], sessions, games, players);
    expect(stats.recentSessions.length).toBe(10);
  });

  it("integration: full stats from DB data", async () => {
    const game1 = await createGame(sampleGame);
    const game2 = await createGame({ ...sampleGame, name: "Azul", bggId: 230802 });
    const alice = await createPlayer("Alice");
    const bob = await createPlayer("Bob");

    await createPlaySession({ gameId: game1.id, playedAt: "2026-01-01", playerCount: 2, duration: 90, winnerId: alice.id });
    await createPlaySession({ gameId: game1.id, playedAt: "2026-01-02", playerCount: 2, duration: 60, winnerId: alice.id });
    await createPlaySession({ gameId: game2.id, playedAt: "2026-01-03", playerCount: 2, duration: 45, winnerId: bob.id });
    await createPlaySession({ gameId: game1.id, playedAt: "2026-01-04", playerCount: 2, duration: 120, winnerId: bob.id });

    const games = await getAllGames();
    const sessions = await getAllSessions();
    const players = await getAllPlayers();

    // Leaderboard
    const leaderboard = computeLeaderboard(sessions, games, players);
    expect(leaderboard.length).toBe(2);
    // Both have 2 wins, tied at rank 1
    expect(leaderboard[0].wins).toBe(2);
    expect(leaderboard[1].wins).toBe(2);
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[1].rank).toBe(1);

    // Player detail
    const aliceStats = computePlayerDetailStats(
      players.find((p) => p.name === "Alice")!,
      sessions,
      games,
      players,
    );
    expect(aliceStats.wins).toBe(2);
    expect(aliceStats.bestStreak).toBe(2);
    expect(aliceStats.favoriteGame!.game.name).toBe("Catan");
  });
});
