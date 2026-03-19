import { describe, it, expect, beforeEach } from "vitest";
import Dexie from "dexie";
import {
  createGame,
  getAllGames,
  getWishlistGames,
  getWishlistCount,
  updateGame,
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
  await Dexie.delete("What2PlayDB");
});

describe("Wishlist CRUD", () => {
  it("creates a game with wishlist=false by default", async () => {
    const game = await createGame(sampleGame);
    expect(game.wishlist).toBe(false);
    expect(game.owned).toBe(true);
  });

  it("creates a wishlist game with owned=false", async () => {
    const game = await createGame({
      ...sampleGame,
      wishlist: true,
      owned: false,
    });
    expect(game.wishlist).toBe(true);
    expect(game.owned).toBe(false);
  });

  it("getWishlistGames returns only wishlist games", async () => {
    await createGame(sampleGame); // owned
    await createGame({ ...sampleGame2, wishlist: true, owned: false }); // wishlist

    const wishlist = await getWishlistGames();
    expect(wishlist).toHaveLength(1);
    expect(wishlist[0].name).toBe("Azul");
    expect(wishlist[0].wishlist).toBe(true);
  });

  it("getAllGames does not include wishlist-only games", async () => {
    await createGame(sampleGame); // owned
    await createGame({ ...sampleGame2, wishlist: true, owned: false }); // wishlist

    const owned = await getAllGames();
    expect(owned).toHaveLength(1);
    expect(owned[0].name).toBe("Catan");
  });

  it("getWishlistCount returns correct count", async () => {
    expect(await getWishlistCount()).toBe(0);

    await createGame({ ...sampleGame, wishlist: true, owned: false });
    expect(await getWishlistCount()).toBe(1);

    await createGame({ ...sampleGame2, wishlist: true, owned: false });
    expect(await getWishlistCount()).toBe(2);
  });

  it("can move game from wishlist to collection", async () => {
    const game = await createGame({
      ...sampleGame,
      wishlist: true,
      owned: false,
    });
    expect(game.wishlist).toBe(true);
    expect(game.owned).toBe(false);

    const updated = await updateGame(game.id, { wishlist: false, owned: true });
    expect(updated!.wishlist).toBe(false);
    expect(updated!.owned).toBe(true);

    // Should now appear in owned games
    const owned = await getAllGames();
    expect(owned).toHaveLength(1);
    expect(owned[0].name).toBe("Catan");

    // And not in wishlist
    const wishlist = await getWishlistGames();
    expect(wishlist).toHaveLength(0);
  });

  it("can move game from collection to wishlist", async () => {
    const game = await createGame(sampleGame);
    expect(game.owned).toBe(true);

    await updateGame(game.id, { wishlist: true, owned: false });

    const owned = await getAllGames();
    expect(owned).toHaveLength(0);

    const wishlist = await getWishlistGames();
    expect(wishlist).toHaveLength(1);
  });

  it("wishlist field persists after getGameById", async () => {
    const created = await createGame({
      ...sampleGame,
      wishlist: true,
      owned: false,
    });

    const fetched = await getGameById(created.id);
    expect(fetched).toBeDefined();
    expect(fetched!.wishlist).toBe(true);
  });
});
