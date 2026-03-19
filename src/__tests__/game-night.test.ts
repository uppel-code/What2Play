import { describe, it, expect, beforeEach } from "vitest";
import Dexie from "dexie";
import {
  createGameNight,
  getAllGameNights,
  getGameNight,
  updateGameNight,
  deleteGameNight,
  getUpcomingGameNight,
  createGame,
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

const smallGame: CreateGameInput = {
  name: "7 Wonders Duel",
  bggId: 173346,
  minPlayers: 2,
  maxPlayers: 2,
  playingTime: 30,
  averageWeight: 2.2,
};

beforeEach(async () => {
  await Dexie.delete("What2PlayDB");
});

describe("GameNight CRUD", () => {
  it("creates a game night and returns it with an id", async () => {
    const night = await createGameNight({
      name: "Freitag Spieleabend",
      date: "2026-04-10T19:00",
      playerIds: [1, 2, 3],
      gameIds: [],
    });
    expect(night.id).toBeDefined();
    expect(night.name).toBe("Freitag Spieleabend");
    expect(night.date).toBe("2026-04-10T19:00");
    expect(night.playerIds).toEqual([1, 2, 3]);
    expect(night.gameIds).toEqual([]);
    expect(night.createdAt).toBeTruthy();
  });

  it("creates with default empty arrays when playerIds/gameIds omitted", async () => {
    const night = await createGameNight({
      name: "Minimal",
      date: "2026-05-01T20:00",
    });
    expect(night.playerIds).toEqual([]);
    expect(night.gameIds).toEqual([]);
  });

  it("retrieves a game night by id", async () => {
    const created = await createGameNight({
      name: "Test",
      date: "2026-04-10T19:00",
    });
    const fetched = await getGameNight(created.id);
    expect(fetched).toBeDefined();
    expect(fetched!.name).toBe("Test");
  });

  it("returns undefined for non-existent id", async () => {
    const result = await getGameNight(999);
    expect(result).toBeUndefined();
  });

  it("lists all game nights ordered by date descending", async () => {
    await createGameNight({ name: "Later", date: "2026-06-01T19:00" });
    await createGameNight({ name: "Earlier", date: "2026-04-01T19:00" });
    await createGameNight({ name: "Middle", date: "2026-05-01T19:00" });

    const all = await getAllGameNights();
    expect(all).toHaveLength(3);
    // Reversed order (newest first)
    expect(all[0].name).toBe("Later");
    expect(all[1].name).toBe("Middle");
    expect(all[2].name).toBe("Earlier");
  });

  it("updates a game night", async () => {
    const night = await createGameNight({
      name: "Original",
      date: "2026-04-10T19:00",
      gameIds: [],
    });
    const updated = await updateGameNight(night.id, {
      name: "Updated",
      gameIds: [1, 2],
    });
    expect(updated).toBeDefined();
    expect(updated!.name).toBe("Updated");
    expect(updated!.gameIds).toEqual([1, 2]);
  });

  it("returns undefined when updating non-existent night", async () => {
    const result = await updateGameNight(999, { name: "Nope" });
    expect(result).toBeUndefined();
  });

  it("deletes a game night", async () => {
    const night = await createGameNight({
      name: "Delete me",
      date: "2026-04-10T19:00",
    });
    const deleted = await deleteGameNight(night.id);
    expect(deleted).toBe(true);

    const fetched = await getGameNight(night.id);
    expect(fetched).toBeUndefined();
  });

  it("returns false when deleting non-existent night", async () => {
    const result = await deleteGameNight(999);
    expect(result).toBe(false);
  });

  it("gets upcoming game night (future date)", async () => {
    await createGameNight({ name: "Past", date: "2020-01-01T19:00" });
    await createGameNight({ name: "Future", date: "2099-12-31T19:00" });

    const upcoming = await getUpcomingGameNight();
    expect(upcoming).toBeDefined();
    expect(upcoming!.name).toBe("Future");
  });

  it("returns undefined when no upcoming game nights", async () => {
    await createGameNight({ name: "Past", date: "2020-01-01T19:00" });
    const upcoming = await getUpcomingGameNight();
    expect(upcoming).toBeUndefined();
  });
});

describe("Share text generation", () => {
  it("generates correct share text with games", async () => {
    const game1 = await createGame(sampleGame);
    const game2 = await createGame(sampleGame2);

    const night = await createGameNight({
      name: "Freitag Spieleabend",
      date: "2026-04-10T19:00",
      gameIds: [game1.id, game2.id],
    });

    // Re-fetch games to resolve names
    const gameNames = [game1.name, game2.name];
    const d = new Date(night.date);
    const dateStr = d.toLocaleDateString("de-DE", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    const timeStr = d.toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const expected = `Spieleabend "${night.name}" am ${dateStr} um ${timeStr}! Folgende Spiele sind dabei: ${gameNames.join(", ")}`;

    // Simulate the generateShareText logic
    const text = generateShareText(night, [game1, game2]);
    expect(text).toBe(expected);
  });

  it("generates share text with no games", async () => {
    const night = await createGameNight({
      name: "Leerer Abend",
      date: "2026-04-10T19:00",
      gameIds: [],
    });

    const text = generateShareText(night, []);
    expect(text).toContain("noch keine Spiele");
  });
});

describe("Game filter by player count", () => {
  it("filters games matching player count", async () => {
    const game1 = await createGame(sampleGame); // 3-4 players
    const game2 = await createGame(sampleGame2); // 2-4 players
    const game3 = await createGame(smallGame); // 2-2 players

    const allGames = [game1, game2, game3];
    const playerCount = 3;

    const fitting = allGames.filter(
      (g) => g.minPlayers <= playerCount && g.maxPlayers >= playerCount
    );

    expect(fitting).toHaveLength(2);
    expect(fitting.map((g) => g.name)).toContain("Catan");
    expect(fitting.map((g) => g.name)).toContain("Azul");
    expect(fitting.map((g) => g.name)).not.toContain("7 Wonders Duel");
  });

  it("shows all games when player count is 0", async () => {
    const game1 = await createGame(sampleGame);
    const game2 = await createGame(smallGame);

    const allGames = [game1, game2];
    const playerCount = 0;

    const fitting = allGames.filter(
      (g) => playerCount === 0 || (g.minPlayers <= playerCount && g.maxPlayers >= playerCount)
    );

    expect(fitting).toHaveLength(2);
  });

  it("filters correctly for 2 players", async () => {
    const game1 = await createGame(sampleGame); // 3-4 players
    const game2 = await createGame(sampleGame2); // 2-4 players
    const game3 = await createGame(smallGame); // 2-2 players

    const allGames = [game1, game2, game3];
    const playerCount = 2;

    const fitting = allGames.filter(
      (g) => g.minPlayers <= playerCount && g.maxPlayers >= playerCount
    );

    expect(fitting).toHaveLength(2);
    expect(fitting.map((g) => g.name)).toContain("Azul");
    expect(fitting.map((g) => g.name)).toContain("7 Wonders Duel");
  });
});

// Helper that mirrors the page component's generateShareText
function generateShareText(
  night: { name: string; date: string; gameIds: number[] },
  games: { id: number; name: string }[]
): string {
  const d = new Date(night.date);
  const dateStr = d.toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const timeStr = d.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const gameNames = night.gameIds
    .map((id) => games.find((g) => g.id === id)?.name)
    .filter(Boolean);
  const gameList =
    gameNames.length > 0 ? gameNames.join(", ") : "noch keine Spiele";
  return `Spieleabend "${night.name}" am ${dateStr} um ${timeStr}! Folgende Spiele sind dabei: ${gameList}`;
}
