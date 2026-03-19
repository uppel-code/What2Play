import { describe, it, expect, beforeEach } from "vitest";
import Dexie from "dexie";
import {
  createGame,
  createPlaySession,
  unlockAchievement,
  getAchievement,
  getAllAchievements,
} from "@/lib/db-client";
import {
  checkOnGameAdd,
  checkOnPlaySession,
  checkOnRuleUse,
  checkOnPhotoScan,
  ACHIEVEMENT_DEFINITIONS,
  getDefinition,
} from "@/services/achievements";
import type { CreateGameInput } from "@/types/game";

const sampleGame: CreateGameInput = {
  name: "Catan",
  bggId: 13,
  minPlayers: 3,
  maxPlayers: 4,
  playingTime: 90,
  averageWeight: 2.3,
  categories: ["Negotiation"],
  mechanics: ["Dice Rolling", "Trading", "Route/Network Building"],
};

beforeEach(async () => {
  await Dexie.delete("What2PlayDB");
});

describe("achievements", () => {
  // ── DB Operations ──

  describe("unlockAchievement", () => {
    it("unlocks a new achievement", async () => {
      const result = await unlockAchievement("first_game");
      expect(result).not.toBeNull();
      expect(result!.key).toBe("first_game");
      expect(result!.unlockedAt).toBeTruthy();
    });

    it("returns null if already unlocked", async () => {
      await unlockAchievement("first_game");
      const result = await unlockAchievement("first_game");
      expect(result).toBeNull();
    });
  });

  describe("getAchievement", () => {
    it("returns the achievement by key", async () => {
      await unlockAchievement("first_game");
      const a = await getAchievement("first_game");
      expect(a).toBeDefined();
      expect(a!.key).toBe("first_game");
    });

    it("returns undefined for non-existent achievement", async () => {
      const a = await getAchievement("first_game");
      expect(a).toBeUndefined();
    });
  });

  describe("getAllAchievements", () => {
    it("returns all unlocked achievements", async () => {
      await unlockAchievement("first_game");
      await unlockAchievement("explorer");
      const all = await getAllAchievements();
      expect(all).toHaveLength(2);
      expect(all.map((a) => a.key).sort()).toEqual(["explorer", "first_game"]);
    });

    it("returns empty array when none unlocked", async () => {
      const all = await getAllAchievements();
      expect(all).toEqual([]);
    });
  });

  // ── Achievement Definitions ──

  describe("ACHIEVEMENT_DEFINITIONS", () => {
    it("has 8 achievements defined", () => {
      expect(ACHIEVEMENT_DEFINITIONS).toHaveLength(8);
    });

    it("each has required fields", () => {
      for (const def of ACHIEVEMENT_DEFINITIONS) {
        expect(def.key).toBeTruthy();
        expect(def.title).toBeTruthy();
        expect(def.description).toBeTruthy();
        expect(def.icon).toBeTruthy();
      }
    });

    it("getDefinition returns correct definition", () => {
      const def = getDefinition("first_game");
      expect(def.title).toBe("Sammler");
      expect(def.icon).toBe("🎲");
    });
  });

  // ── checkOnGameAdd ──

  describe("checkOnGameAdd", () => {
    it("unlocks first_game on first add", async () => {
      await createGame(sampleGame);
      const unlocked = await checkOnGameAdd();
      expect(unlocked).toContain("first_game");
    });

    it("does not re-unlock first_game", async () => {
      await createGame(sampleGame);
      await checkOnGameAdd();
      await createGame({ ...sampleGame, name: "Azul", bggId: 230802 });
      const unlocked = await checkOnGameAdd();
      expect(unlocked).not.toContain("first_game");
    });

    it("unlocks collector_10 at 10 games", async () => {
      for (let i = 0; i < 10; i++) {
        await createGame({ ...sampleGame, name: `Game ${i}`, bggId: 100 + i });
      }
      const unlocked = await checkOnGameAdd();
      expect(unlocked).toContain("collector_10");
    });
  });

  // ── checkOnPlaySession ──

  describe("checkOnPlaySession", () => {
    it("unlocks shame_buster when playing a never-played game", async () => {
      const game = await createGame(sampleGame);
      await createPlaySession({
        gameId: game.id,
        playedAt: "2026-03-19",
        playerCount: 3,
        duration: 90,
      });
      // game.lastPlayed was null before the session
      const unlocked = await checkOnPlaySession(null, game.mechanics);
      expect(unlocked).toContain("shame_buster");
    });

    it("does not unlock shame_buster for already-played game", async () => {
      const game = await createGame(sampleGame);
      await createPlaySession({
        gameId: game.id,
        playedAt: "2026-03-18",
        playerCount: 3,
        duration: 90,
      });
      const unlocked = await checkOnPlaySession("2026-03-18", game.mechanics);
      expect(unlocked).not.toContain("shame_buster");
    });

    it("unlocks variety_5 when 5+ mechanics played", async () => {
      const game = await createGame({
        ...sampleGame,
        mechanics: ["Dice Rolling", "Trading", "Route Building", "Worker Placement", "Drafting"],
      });
      await createPlaySession({
        gameId: game.id,
        playedAt: "2026-03-19",
        playerCount: 3,
        duration: 90,
      });
      const unlocked = await checkOnPlaySession(null, game.mechanics);
      expect(unlocked).toContain("variety_5");
    });

    it("unlocks streak_3 when 3 consecutive days played", async () => {
      const game = await createGame(sampleGame);
      await createPlaySession({ gameId: game.id, playedAt: "2026-03-17", playerCount: 3, duration: 90 });
      await createPlaySession({ gameId: game.id, playedAt: "2026-03-18", playerCount: 3, duration: 90 });
      await createPlaySession({ gameId: game.id, playedAt: "2026-03-19", playerCount: 3, duration: 90 });
      const unlocked = await checkOnPlaySession("2026-03-18", []);
      expect(unlocked).toContain("streak_3");
    });

    it("does not unlock streak_3 with gaps", async () => {
      const game = await createGame(sampleGame);
      await createPlaySession({ gameId: game.id, playedAt: "2026-03-15", playerCount: 3, duration: 90 });
      await createPlaySession({ gameId: game.id, playedAt: "2026-03-17", playerCount: 3, duration: 90 });
      await createPlaySession({ gameId: game.id, playedAt: "2026-03-19", playerCount: 3, duration: 90 });
      const unlocked = await checkOnPlaySession("2026-03-17", []);
      expect(unlocked).not.toContain("streak_3");
    });
  });

  // ── checkOnRuleUse ──

  describe("checkOnRuleUse", () => {
    it("unlocks rule_master at 5 uses", async () => {
      const unlocked = await checkOnRuleUse(5);
      expect(unlocked).toContain("rule_master");
    });

    it("does not unlock rule_master below 5", async () => {
      const unlocked = await checkOnRuleUse(4);
      expect(unlocked).toEqual([]);
    });

    it("does not re-unlock rule_master", async () => {
      await checkOnRuleUse(5);
      const unlocked = await checkOnRuleUse(10);
      expect(unlocked).toEqual([]);
    });
  });

  // ── checkOnPhotoScan ──

  describe("checkOnPhotoScan", () => {
    it("unlocks explorer on first photo scan", async () => {
      const unlocked = await checkOnPhotoScan();
      expect(unlocked).toContain("explorer");
    });

    it("does not re-unlock explorer", async () => {
      await checkOnPhotoScan();
      const unlocked = await checkOnPhotoScan();
      expect(unlocked).toEqual([]);
    });
  });
});
