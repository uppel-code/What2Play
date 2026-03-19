import { describe, it, expect, beforeEach } from "vitest";
import Dexie from "dexie";
import {
  createGame,
  saveQuickRules,
  getQuickRules,
  getGameById,
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

beforeEach(async () => {
  await Dexie.delete("What2PlayDB");
});

describe("db-client quickRules", () => {
  describe("saveQuickRules", () => {
    it("saves quick rules to a game", async () => {
      const game = await createGame(sampleGame);
      await saveQuickRules(game.id, "**Ziel:** 10 Siegpunkte erreichen.");

      const updated = await getGameById(game.id);
      expect(updated).toBeDefined();
      expect(updated!.quickRules).toBe("**Ziel:** 10 Siegpunkte erreichen.");
    });

    it("overwrites existing quick rules", async () => {
      const game = await createGame(sampleGame);
      await saveQuickRules(game.id, "Alte Regeln");
      await saveQuickRules(game.id, "Neue Regeln");

      const updated = await getGameById(game.id);
      expect(updated!.quickRules).toBe("Neue Regeln");
    });
  });

  describe("getQuickRules", () => {
    it("returns saved quick rules", async () => {
      const game = await createGame(sampleGame);
      await saveQuickRules(game.id, "Regeln hier");

      const rules = await getQuickRules(game.id);
      expect(rules).toBe("Regeln hier");
    });

    it("returns null when no quick rules saved", async () => {
      const game = await createGame(sampleGame);
      const rules = await getQuickRules(game.id);
      expect(rules).toBeNull();
    });

    it("returns null for non-existent game", async () => {
      const rules = await getQuickRules(999);
      expect(rules).toBeNull();
    });
  });
});
