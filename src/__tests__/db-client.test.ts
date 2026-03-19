import { describe, it, expect, beforeEach } from "vitest";
import Dexie from "dexie";
import {
  getAllGames,
  createGame,
  deleteGame,
  getGameById,
  getGameByBggId,
  updateGame,
  getGameCount,
  getAllPlayers,
  createPlayer,
  updatePlayer,
  deletePlayer,
  createPlayGroup,
  getAllPlayGroups,
  getPlayGroup,
  updatePlayGroup,
  deletePlayGroup,
  createPlaySession,
  getSessionsByGame,
  getAllSessions,
  deletePlaySession,
  getPlayStats,
  createLoan,
  returnLoan,
  deleteLoan,
  getActiveLoanByGame,
  getLoansByGame,
  getAllActiveLoans,
} from "@/lib/db-client";
import type { CreateGameInput } from "@/types/game";

const sampleGame: CreateGameInput = {
  name: "Catan",
  bggId: 13,
  minPlayers: 3,
  maxPlayers: 4,
  playingTime: 90,
  averageWeight: 2.3,
  categories: ["Negotiation"],
  mechanics: ["Dice Rolling"],
};

const sampleGame2: CreateGameInput = {
  name: "Azul",
  bggId: 230802,
  minPlayers: 2,
  maxPlayers: 4,
  playingTime: 45,
  averageWeight: 1.8,
};

beforeEach(async () => {
  // Wipe all Dexie databases between tests
  await Dexie.delete("What2PlayDB");
});

describe("db-client", () => {
  // ── createGame ──

  describe("createGame", () => {
    it("creates a game and returns it with an id", async () => {
      const game = await createGame(sampleGame);
      expect(game.id).toBeDefined();
      expect(game.name).toBe("Catan");
      expect(game.bggId).toBe(13);
      expect(game.minPlayers).toBe(3);
      expect(game.maxPlayers).toBe(4);
      expect(game.playingTime).toBe(90);
      expect(game.owned).toBe(true);
      expect(game.favorite).toBe(false);
      expect(game.createdAt).toBeTruthy();
      expect(game.updatedAt).toBeTruthy();
    });

    it("sets default values for optional fields", async () => {
      const game = await createGame({
        name: "Simple",
        minPlayers: 1,
        maxPlayers: 2,
        playingTime: 20,
      });
      expect(game.averageWeight).toBe(2.0);
      expect(game.minPlayTime).toBe(20);
      expect(game.maxPlayTime).toBe(20);
      expect(game.minAge).toBe(0);
      expect(game.categories).toEqual([]);
      expect(game.mechanics).toEqual([]);
      expect(game.tags).toEqual([]);
      expect(game.thumbnail).toBeNull();
      expect(game.image).toBeNull();
      expect(game.notes).toBeNull();
      expect(game.lastPlayed).toBeNull();
    });
  });

  // ── getAllGames ──

  describe("getAllGames", () => {
    it("returns empty array when no games exist", async () => {
      const games = await getAllGames();
      expect(games).toEqual([]);
    });

    it("returns only owned games sorted by name", async () => {
      await createGame(sampleGame); // Catan
      await createGame(sampleGame2); // Azul
      await createGame({ ...sampleGame, name: "Zug um Zug", bggId: 9209, owned: false });

      const games = await getAllGames();
      expect(games).toHaveLength(2);
      expect(games[0].name).toBe("Azul");
      expect(games[1].name).toBe("Catan");
    });
  });

  // ── getGameById ──

  describe("getGameById", () => {
    it("returns the game by id", async () => {
      const created = await createGame(sampleGame);
      const found = await getGameById(created.id);
      expect(found).toBeDefined();
      expect(found!.name).toBe("Catan");
    });

    it("returns undefined for non-existent id", async () => {
      const found = await getGameById(999);
      expect(found).toBeUndefined();
    });
  });

  // ── getGameByBggId ──

  describe("getGameByBggId", () => {
    it("finds a game by BGG id", async () => {
      await createGame(sampleGame);
      const found = await getGameByBggId(13);
      expect(found).toBeDefined();
      expect(found!.name).toBe("Catan");
    });

    it("returns undefined when not found", async () => {
      const found = await getGameByBggId(99999);
      expect(found).toBeUndefined();
    });
  });

  // ── updateGame ──

  describe("updateGame", () => {
    it("updates game fields", async () => {
      const created = await createGame(sampleGame);
      const updated = await updateGame(created.id, { favorite: true, notes: "Great game" });
      expect(updated).toBeDefined();
      expect(updated!.favorite).toBe(true);
      expect(updated!.notes).toBe("Great game");
      expect(updated!.updatedAt).not.toBe(created.updatedAt);
    });
  });

  // ── deleteGame ──

  describe("deleteGame", () => {
    it("deletes an existing game and returns true", async () => {
      const game = await createGame(sampleGame);
      const result = await deleteGame(game.id);
      expect(result).toBe(true);

      const found = await getGameById(game.id);
      expect(found).toBeUndefined();
    });

    it("returns false for non-existent game", async () => {
      const result = await deleteGame(999);
      expect(result).toBe(false);
    });
  });

  // ── getGameCount ──

  describe("getGameCount", () => {
    it("counts only owned games", async () => {
      await createGame(sampleGame);
      await createGame(sampleGame2);
      await createGame({ ...sampleGame, name: "Unowned", bggId: 1, owned: false });

      const count = await getGameCount();
      expect(count).toBe(2);
    });
  });

  // ── Player operations ──

  describe("player operations", () => {
    it("creates and lists players", async () => {
      await createPlayer("Alice", 3.0, 60);
      await createPlayer("Bob");

      const players = await getAllPlayers();
      expect(players).toHaveLength(2);
      expect(players[0].name).toBe("Alice");
      expect(players[0].maxComplexity).toBe(3.0);
      expect(players[1].name).toBe("Bob");
      expect(players[1].maxComplexity).toBeUndefined();
    });

    it("deletes player and removes from groups", async () => {
      const player = await createPlayer("Alice");
      const group = await createPlayGroup("Group 1", [player.id]);

      const result = await deletePlayer(player.id);
      expect(result).toBe(true);

      const groups = await getAllPlayGroups();
      expect(groups[0].playerIds).toEqual([]);
    });
  });

  // ── PlayGroup operations ──

  describe("playGroup operations", () => {
    it("creates and deletes play groups", async () => {
      const group = await createPlayGroup("Friday Night", []);
      expect(group.name).toBe("Friday Night");

      const deleted = await deletePlayGroup(group.id);
      expect(deleted).toBe(true);

      const groups = await getAllPlayGroups();
      expect(groups).toHaveLength(0);
    });

    it("returns false when deleting non-existent group", async () => {
      const result = await deletePlayGroup(999);
      expect(result).toBe(false);
    });
  });

  // ── updatePlayer ──

  describe("updatePlayer", () => {
    it("updates player fields", async () => {
      const player = await createPlayer("Alice");
      const updated = await updatePlayer(player.id, { name: "Alice B", maxComplexity: 4.0 });
      expect(updated).toBeDefined();
      expect(updated!.name).toBe("Alice B");
      expect(updated!.maxComplexity).toBe(4.0);
    });

    it("returns undefined for non-existent player", async () => {
      const result = await updatePlayer(999, { name: "Nobody" });
      expect(result).toBeUndefined();
    });
  });

  // ── getPlayGroup / updatePlayGroup ──

  describe("getPlayGroup", () => {
    it("returns a group by id", async () => {
      const group = await createPlayGroup("Game Night", []);
      const found = await getPlayGroup(group.id);
      expect(found).toBeDefined();
      expect(found!.name).toBe("Game Night");
    });

    it("returns undefined for non-existent group", async () => {
      const found = await getPlayGroup(999);
      expect(found).toBeUndefined();
    });
  });

  describe("updatePlayGroup", () => {
    it("updates group name and players", async () => {
      const p1 = await createPlayer("Alice");
      const group = await createPlayGroup("Old Name", []);
      const updated = await updatePlayGroup(group.id, { name: "New Name", playerIds: [p1.id] });
      expect(updated).toBeDefined();
      expect(updated!.name).toBe("New Name");
      expect(updated!.playerIds).toEqual([p1.id]);
    });
  });

  // ── PlaySession operations ──

  describe("playSession operations", () => {
    it("creates a play session and updates game lastPlayed", async () => {
      const game = await createGame(sampleGame);
      const session = await createPlaySession({
        gameId: game.id,
        playedAt: "2024-06-15",
        playerCount: 3,
        duration: 90,
      });

      expect(session.gameId).toBe(game.id);
      expect(session.playerCount).toBe(3);

      const updatedGame = await getGameById(game.id);
      expect(updatedGame!.lastPlayed).toBe("2024-06-15");
    });

    it("gets sessions by game", async () => {
      const game = await createGame(sampleGame);
      await createPlaySession({ gameId: game.id, playedAt: "2024-06-15", playerCount: 3, duration: 90 });
      await createPlaySession({ gameId: game.id, playedAt: "2024-06-16", playerCount: 4, duration: 60 });

      const sessions = await getSessionsByGame(game.id);
      expect(sessions).toHaveLength(2);
    });

    it("gets all sessions", async () => {
      const game1 = await createGame(sampleGame);
      const game2 = await createGame(sampleGame2);
      await createPlaySession({ gameId: game1.id, playedAt: "2024-06-15", playerCount: 3, duration: 90 });
      await createPlaySession({ gameId: game2.id, playedAt: "2024-06-16", playerCount: 2, duration: 45 });

      const sessions = await getAllSessions();
      expect(sessions).toHaveLength(2);
    });

    it("deletes a play session", async () => {
      const game = await createGame(sampleGame);
      const session = await createPlaySession({ gameId: game.id, playedAt: "2024-06-15", playerCount: 3, duration: 90 });

      const result = await deletePlaySession(session.id);
      expect(result).toBe(true);

      const sessions = await getSessionsByGame(game.id);
      expect(sessions).toHaveLength(0);
    });

    it("returns false when deleting non-existent session", async () => {
      const result = await deletePlaySession(999);
      expect(result).toBe(false);
    });
  });

  // ── getPlayStats ──

  describe("getPlayStats", () => {
    it("computes stats correctly", async () => {
      const game1 = await createGame(sampleGame);
      const game2 = await createGame(sampleGame2);
      const today = new Date().toISOString().split("T")[0];

      await createPlaySession({ gameId: game1.id, playedAt: today, playerCount: 3, duration: 90 });
      await createPlaySession({ gameId: game1.id, playedAt: today, playerCount: 3, duration: 90 });
      await createPlaySession({ gameId: game2.id, playedAt: "2020-01-01", playerCount: 2, duration: 45 });

      const stats = await getPlayStats();
      expect(stats.totalPlayed).toBe(3);
      expect(stats.thisWeekCount).toBeGreaterThanOrEqual(2);
      expect(stats.mostPlayedGameId).toBe(game1.id);
      expect(stats.mostPlayedCount).toBe(2);
    });

    it("returns zeros when no sessions exist", async () => {
      const stats = await getPlayStats();
      expect(stats.totalPlayed).toBe(0);
      expect(stats.thisWeekCount).toBe(0);
      expect(stats.mostPlayedGameId).toBeNull();
      expect(stats.mostPlayedCount).toBe(0);
    });
  });

  // ── Loan operations (Leih-Tracker) ──

  describe("loan operations", () => {
    it("creates a loan and retrieves it", async () => {
      const game = await createGame(sampleGame);
      const loan = await createLoan({
        gameId: game.id,
        personName: "Alex",
        loanDate: "2026-03-01",
      });

      expect(loan.id).toBeDefined();
      expect(loan.gameId).toBe(game.id);
      expect(loan.personName).toBe("Alex");
      expect(loan.loanDate).toBe("2026-03-01");
      expect(loan.returnedAt).toBeNull();
    });

    it("gets active loan by game", async () => {
      const game = await createGame(sampleGame);
      await createLoan({ gameId: game.id, personName: "Alex", loanDate: "2026-03-01" });

      const active = await getActiveLoanByGame(game.id);
      expect(active).toBeDefined();
      expect(active!.personName).toBe("Alex");
    });

    it("returns undefined when no active loan exists", async () => {
      const game = await createGame(sampleGame);
      const active = await getActiveLoanByGame(game.id);
      expect(active).toBeUndefined();
    });

    it("returns a loan (marks as returned)", async () => {
      const game = await createGame(sampleGame);
      const loan = await createLoan({ gameId: game.id, personName: "Alex", loanDate: "2026-03-01" });

      const returned = await returnLoan(loan.id);
      expect(returned).toBeDefined();
      expect(returned!.returnedAt).not.toBeNull();

      const active = await getActiveLoanByGame(game.id);
      expect(active).toBeUndefined();
    });

    it("deletes a loan", async () => {
      const game = await createGame(sampleGame);
      const loan = await createLoan({ gameId: game.id, personName: "Alex", loanDate: "2026-03-01" });

      const result = await deleteLoan(loan.id);
      expect(result).toBe(true);

      const loans = await getLoansByGame(game.id);
      expect(loans).toHaveLength(0);
    });

    it("returns false when deleting non-existent loan", async () => {
      const result = await deleteLoan(999);
      expect(result).toBe(false);
    });

    it("gets all active loans across games", async () => {
      const game1 = await createGame(sampleGame);
      const game2 = await createGame(sampleGame2);
      await createLoan({ gameId: game1.id, personName: "Alex", loanDate: "2026-03-01" });
      await createLoan({ gameId: game2.id, personName: "Bob", loanDate: "2026-03-05" });

      const activeLoans = await getAllActiveLoans();
      expect(activeLoans).toHaveLength(2);
    });

    it("returned loans are not included in active loans", async () => {
      const game = await createGame(sampleGame);
      const loan = await createLoan({ gameId: game.id, personName: "Alex", loanDate: "2026-03-01" });
      await returnLoan(loan.id);

      const activeLoans = await getAllActiveLoans();
      expect(activeLoans).toHaveLength(0);
    });

    it("gets loan history for a game", async () => {
      const game = await createGame(sampleGame);
      const loan1 = await createLoan({ gameId: game.id, personName: "Alex", loanDate: "2026-02-01" });
      await returnLoan(loan1.id);
      await createLoan({ gameId: game.id, personName: "Bob", loanDate: "2026-03-01" });

      const loans = await getLoansByGame(game.id);
      expect(loans).toHaveLength(2);
    });
  });
});
