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
  computeGameStats,
  computeGlobalStats,
} from "@/services/win-loss-stats";
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

// ─── computeGameStats ───

describe("computeGameStats", () => {
  it("returns empty stats for no sessions", () => {
    const stats = computeGameStats([], []);
    expect(stats.totalPlayed).toBe(0);
    expect(stats.winRateByPlayer).toEqual([]);
    expect(stats.mostCommonResult).toBe("–");
    expect(stats.lastSession).toBeNull();
    expect(stats.averageDuration).toBe(0);
  });

  it("computes totalPlayed correctly", () => {
    const sessions = [
      { id: 1, gameId: 1, playedAt: "2026-01-01", playerCount: 3, duration: 90, winnerId: null, notes: null, createdAt: "" },
      { id: 2, gameId: 1, playedAt: "2026-01-02", playerCount: 3, duration: 60, winnerId: null, notes: null, createdAt: "" },
    ] as PlaySession[];

    const stats = computeGameStats(sessions, []);
    expect(stats.totalPlayed).toBe(2);
  });

  it("computes averageDuration correctly", () => {
    const sessions = [
      { id: 1, gameId: 1, playedAt: "2026-01-01", playerCount: 3, duration: 90, winnerId: null, notes: null, createdAt: "" },
      { id: 2, gameId: 1, playedAt: "2026-01-02", playerCount: 3, duration: 60, winnerId: null, notes: null, createdAt: "" },
      { id: 3, gameId: 1, playedAt: "2026-01-03", playerCount: 3, duration: 30, winnerId: null, notes: null, createdAt: "" },
    ] as PlaySession[];

    const stats = computeGameStats(sessions, []);
    expect(stats.averageDuration).toBe(60); // (90+60+30)/3
  });

  it("computes win rate by player", () => {
    const players: Player[] = [
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ];
    const sessions = [
      { id: 1, gameId: 1, playedAt: "2026-01-01", playerCount: 2, duration: 60, winnerId: 1, notes: null, createdAt: "" },
      { id: 2, gameId: 1, playedAt: "2026-01-02", playerCount: 2, duration: 60, winnerId: 1, notes: null, createdAt: "" },
      { id: 3, gameId: 1, playedAt: "2026-01-03", playerCount: 2, duration: 60, winnerId: 2, notes: null, createdAt: "" },
      { id: 4, gameId: 1, playedAt: "2026-01-04", playerCount: 2, duration: 60, winnerId: null, notes: null, createdAt: "" },
    ] as PlaySession[];

    const stats = computeGameStats(sessions, players);
    expect(stats.winRateByPlayer.length).toBe(2);

    const alice = stats.winRateByPlayer.find((w) => w.player.name === "Alice")!;
    expect(alice.wins).toBe(2);
    expect(alice.rate).toBe(50); // 2/4 = 50%

    const bob = stats.winRateByPlayer.find((w) => w.player.name === "Bob")!;
    expect(bob.wins).toBe(1);
    expect(bob.rate).toBe(25); // 1/4 = 25%
  });

  it("sorts win rate by most wins first", () => {
    const players: Player[] = [
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ];
    const sessions = [
      { id: 1, gameId: 1, playedAt: "2026-01-01", playerCount: 2, duration: 60, winnerId: 2, notes: null, createdAt: "" },
      { id: 2, gameId: 1, playedAt: "2026-01-02", playerCount: 2, duration: 60, winnerId: 2, notes: null, createdAt: "" },
      { id: 3, gameId: 1, playedAt: "2026-01-03", playerCount: 2, duration: 60, winnerId: 1, notes: null, createdAt: "" },
    ] as PlaySession[];

    const stats = computeGameStats(sessions, players);
    expect(stats.winRateByPlayer[0].player.name).toBe("Bob");
    expect(stats.winRateByPlayer[1].player.name).toBe("Alice");
  });

  it("computes mostCommonResult from top winner", () => {
    const players: Player[] = [
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ];
    const sessions = [
      { id: 1, gameId: 1, playedAt: "2026-01-01", playerCount: 2, duration: 60, winnerId: 1, notes: null, createdAt: "" },
      { id: 2, gameId: 1, playedAt: "2026-01-02", playerCount: 2, duration: 60, winnerId: 1, notes: null, createdAt: "" },
      { id: 3, gameId: 1, playedAt: "2026-01-03", playerCount: 2, duration: 60, winnerId: 2, notes: null, createdAt: "" },
    ] as PlaySession[];

    const stats = computeGameStats(sessions, players);
    expect(stats.mostCommonResult).toBe("Alice gewinnt");
  });

  it("returns 'Kein Gewinner' when no winners recorded", () => {
    const sessions = [
      { id: 1, gameId: 1, playedAt: "2026-01-01", playerCount: 2, duration: 60, winnerId: null, notes: null, createdAt: "" },
    ] as PlaySession[];

    const stats = computeGameStats(sessions, []);
    expect(stats.mostCommonResult).toBe("Kein Gewinner");
  });

  it("returns correct lastSession", () => {
    const players: Player[] = [{ id: 1, name: "Alice" }];
    const sessions = [
      { id: 1, gameId: 1, playedAt: "2026-01-01", playerCount: 2, duration: 60, winnerId: null, notes: null, createdAt: "" },
      { id: 2, gameId: 1, playedAt: "2026-03-15", playerCount: 3, duration: 120, winnerId: 1, notes: null, createdAt: "" },
      { id: 3, gameId: 1, playedAt: "2026-02-10", playerCount: 2, duration: 90, winnerId: null, notes: null, createdAt: "" },
    ] as PlaySession[];

    const stats = computeGameStats(sessions, players);
    expect(stats.lastSession).not.toBeNull();
    expect(stats.lastSession!.playedAt).toBe("2026-03-15");
    expect(stats.lastSession!.winnerName).toBe("Alice");
    expect(stats.lastSession!.duration).toBe(120);
  });
});

// ─── computeGlobalStats ───

describe("computeGlobalStats", () => {
  it("returns zero stats for empty data", () => {
    const stats = computeGlobalStats([], [], []);
    expect(stats.totalSessions).toBe(0);
    expect(stats.uniqueGames).toBe(0);
    expect(stats.bestPlayer).toBeNull();
    expect(stats.favoriteGame).toBeNull();
    expect(stats.winStreak).toBeNull();
  });

  it("computes totalSessions and uniqueGames", () => {
    const sessions = [
      { id: 1, gameId: 1, playedAt: "2026-01-01", winnerId: null },
      { id: 2, gameId: 1, playedAt: "2026-01-02", winnerId: null },
      { id: 3, gameId: 2, playedAt: "2026-01-03", winnerId: null },
    ] as PlaySession[];

    const stats = computeGlobalStats(sessions, [], []);
    expect(stats.totalSessions).toBe(3);
    expect(stats.uniqueGames).toBe(2);
  });

  it("finds best player (most wins)", () => {
    const players: Player[] = [
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ];
    const sessions = [
      { id: 1, gameId: 1, playedAt: "2026-01-01", winnerId: 1 },
      { id: 2, gameId: 1, playedAt: "2026-01-02", winnerId: 1 },
      { id: 3, gameId: 1, playedAt: "2026-01-03", winnerId: 2 },
      { id: 4, gameId: 1, playedAt: "2026-01-04", winnerId: 1 },
    ] as PlaySession[];

    const stats = computeGlobalStats(sessions, [], players);
    expect(stats.bestPlayer).not.toBeNull();
    expect(stats.bestPlayer!.player.name).toBe("Alice");
    expect(stats.bestPlayer!.wins).toBe(3);
  });

  it("finds favorite game (most sessions)", () => {
    const games = [
      { id: 1, name: "Catan" } as Game,
      { id: 2, name: "Azul" } as Game,
    ];
    const sessions = [
      { id: 1, gameId: 1, playedAt: "2026-01-01", winnerId: null },
      { id: 2, gameId: 1, playedAt: "2026-01-02", winnerId: null },
      { id: 3, gameId: 1, playedAt: "2026-01-03", winnerId: null },
      { id: 4, gameId: 2, playedAt: "2026-01-04", winnerId: null },
    ] as PlaySession[];

    const stats = computeGlobalStats(sessions, games, []);
    expect(stats.favoriteGame).not.toBeNull();
    expect(stats.favoriteGame!.game.name).toBe("Catan");
    expect(stats.favoriteGame!.count).toBe(3);
  });

  it("finds win streak of 2+ consecutive wins", () => {
    const players: Player[] = [
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ];
    const sessions = [
      { id: 1, gameId: 1, playedAt: "2026-01-01", winnerId: 2 },
      { id: 2, gameId: 1, playedAt: "2026-01-02", winnerId: 1 },
      { id: 3, gameId: 1, playedAt: "2026-01-03", winnerId: 1 },
      { id: 4, gameId: 1, playedAt: "2026-01-04", winnerId: 1 },
      { id: 5, gameId: 1, playedAt: "2026-01-05", winnerId: 2 },
    ] as PlaySession[];

    const stats = computeGlobalStats(sessions, [], players);
    expect(stats.winStreak).not.toBeNull();
    expect(stats.winStreak!.player.name).toBe("Alice");
    expect(stats.winStreak!.streak).toBe(3);
  });

  it("returns null winStreak when no 2+ consecutive wins", () => {
    const players: Player[] = [
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ];
    const sessions = [
      { id: 1, gameId: 1, playedAt: "2026-01-01", winnerId: 1 },
      { id: 2, gameId: 1, playedAt: "2026-01-02", winnerId: 2 },
      { id: 3, gameId: 1, playedAt: "2026-01-03", winnerId: 1 },
    ] as PlaySession[];

    const stats = computeGlobalStats(sessions, [], players);
    expect(stats.winStreak).toBeNull();
  });

  it("integration: full stats from DB data", async () => {
    const game1 = await createGame(sampleGame);
    const game2 = await createGame({
      ...sampleGame,
      name: "Azul",
      bggId: 230802,
    });
    const alice = await createPlayer("Alice");
    const bob = await createPlayer("Bob");

    // 3 sessions game1, 1 session game2
    await createPlaySession({ gameId: game1.id, playedAt: "2026-01-01", playerCount: 2, duration: 90, winnerId: alice.id });
    await createPlaySession({ gameId: game1.id, playedAt: "2026-01-02", playerCount: 2, duration: 60, winnerId: alice.id });
    await createPlaySession({ gameId: game1.id, playedAt: "2026-01-03", playerCount: 2, duration: 120, winnerId: bob.id });
    await createPlaySession({ gameId: game2.id, playedAt: "2026-01-04", playerCount: 2, duration: 30, winnerId: bob.id });

    const games = await getAllGames();
    const sessions = await getAllSessions();
    const players = await getAllPlayers();

    // Per-game stats for game1
    const gameSessions = sessions.filter((s) => s.gameId === game1.id);
    const gameStats = computeGameStats(gameSessions, players);

    expect(gameStats.totalPlayed).toBe(3);
    expect(gameStats.averageDuration).toBe(90); // (90+60+120)/3
    expect(gameStats.winRateByPlayer.length).toBe(2);
    expect(gameStats.winRateByPlayer[0].player.name).toBe("Alice");
    expect(gameStats.winRateByPlayer[0].wins).toBe(2);
    expect(gameStats.mostCommonResult).toBe("Alice gewinnt");
    expect(gameStats.lastSession!.playedAt).toBe("2026-01-03");
    expect(gameStats.lastSession!.winnerName).toBe("Bob");

    // Global stats
    const global = computeGlobalStats(sessions, games, players);

    expect(global.totalSessions).toBe(4);
    expect(global.uniqueGames).toBe(2);
    // Alice and Bob both have 2 wins; either could be bestPlayer
    expect(global.bestPlayer).not.toBeNull();
    expect(global.bestPlayer!.wins).toBe(2);
    expect(["Alice", "Bob"]).toContain(global.bestPlayer!.player.name);
    expect(global.favoriteGame!.game.name).toBe("Catan");
    expect(global.favoriteGame!.count).toBe(3);
    // Win streak: Alice wins 2 consecutive, Bob wins 2 consecutive
    expect(global.winStreak).not.toBeNull();
    expect(global.winStreak!.streak).toBe(2);
  });
});
