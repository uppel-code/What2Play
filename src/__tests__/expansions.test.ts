import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import Dexie from "dexie";
import {
  createGame,
  createExpansion,
  getExpansionsByGame,
  updateExpansion,
  deleteExpansion,
  getOwnedExpansionCount,
} from "@/lib/db-client";
import type { CreateGameInput } from "@/types/game";

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

describe("Expansion CRUD", () => {
  it("creates an expansion and returns it with an id", async () => {
    const game = await createGame(sampleGame);
    const exp = await createExpansion({
      parentGameId: game.id,
      bggId: 926,
      name: "Catan: Seafarers",
    });
    expect(exp.id).toBeDefined();
    expect(exp.parentGameId).toBe(game.id);
    expect(exp.bggId).toBe(926);
    expect(exp.name).toBe("Catan: Seafarers");
    expect(exp.owned).toBe(true); // default owned=true
    expect(exp.notes).toBeNull();
  });

  it("creates an expansion with owned=false (wishlist)", async () => {
    const game = await createGame(sampleGame);
    const exp = await createExpansion({
      parentGameId: game.id,
      name: "Catan: Cities & Knights",
      owned: false,
    });
    expect(exp.owned).toBe(false);
    expect(exp.bggId).toBeNull();
  });

  it("gets expansions by game, sorted by name", async () => {
    const game = await createGame(sampleGame);
    await createExpansion({ parentGameId: game.id, name: "Seafarers" });
    await createExpansion({ parentGameId: game.id, name: "Cities & Knights" });
    await createExpansion({ parentGameId: game.id, name: "Traders & Barbarians" });

    const exps = await getExpansionsByGame(game.id);
    expect(exps).toHaveLength(3);
    expect(exps[0].name).toBe("Cities & Knights");
    expect(exps[1].name).toBe("Seafarers");
    expect(exps[2].name).toBe("Traders & Barbarians");
  });

  it("does not return expansions from other games", async () => {
    const game1 = await createGame(sampleGame);
    const game2 = await createGame({ ...sampleGame, name: "Azul", bggId: 230802 });
    await createExpansion({ parentGameId: game1.id, name: "Catan Exp" });
    await createExpansion({ parentGameId: game2.id, name: "Azul Exp" });

    const exps1 = await getExpansionsByGame(game1.id);
    expect(exps1).toHaveLength(1);
    expect(exps1[0].name).toBe("Catan Exp");
  });

  it("updates an expansion (toggle owned)", async () => {
    const game = await createGame(sampleGame);
    const exp = await createExpansion({ parentGameId: game.id, name: "Seafarers", owned: false });
    expect(exp.owned).toBe(false);

    const updated = await updateExpansion(exp.id, { owned: true });
    expect(updated).toBeDefined();
    expect(updated!.owned).toBe(true);
    expect(updated!.name).toBe("Seafarers");
  });

  it("updates expansion notes", async () => {
    const game = await createGame(sampleGame);
    const exp = await createExpansion({ parentGameId: game.id, name: "Seafarers" });

    const updated = await updateExpansion(exp.id, { notes: "Gift from friend" });
    expect(updated!.notes).toBe("Gift from friend");
  });

  it("returns undefined when updating non-existent expansion", async () => {
    const result = await updateExpansion(999, { owned: true });
    expect(result).toBeUndefined();
  });

  it("deletes an expansion", async () => {
    const game = await createGame(sampleGame);
    const exp = await createExpansion({ parentGameId: game.id, name: "Seafarers" });

    const deleted = await deleteExpansion(exp.id);
    expect(deleted).toBe(true);

    const remaining = await getExpansionsByGame(game.id);
    expect(remaining).toHaveLength(0);
  });

  it("returns false when deleting non-existent expansion", async () => {
    const deleted = await deleteExpansion(999);
    expect(deleted).toBe(false);
  });

  it("counts owned expansions", async () => {
    const game = await createGame(sampleGame);
    await createExpansion({ parentGameId: game.id, name: "Seafarers", owned: true });
    await createExpansion({ parentGameId: game.id, name: "Cities & Knights", owned: true });
    await createExpansion({ parentGameId: game.id, name: "Traders", owned: false });

    const count = await getOwnedExpansionCount(game.id);
    expect(count).toBe(2);
  });

  it("returns 0 owned count when no expansions exist", async () => {
    const game = await createGame(sampleGame);
    const count = await getOwnedExpansionCount(game.id);
    expect(count).toBe(0);
  });
});
