import { describe, it, expect } from "vitest";
import { recommendGames, categorizeResults, calcMoodBonus, daysBetween } from "@/services/recommendation";
import type { Game, TodayPlayParams } from "@/types/game";

function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: 1,
    bggId: null,
    name: "Test Game",
    yearpublished: null,
    minPlayers: 2,
    maxPlayers: 4,
    playingTime: 60,
    minPlayTime: 45,
    maxPlayTime: 75,
    minAge: 10,
    averageWeight: 2.5,
    thumbnail: null,
    image: null,
    categories: [],
    mechanics: [],
    bggRating: null,
    bggRank: null,
    quickRules: null,
    owned: true,
    shelfLocation: null,
    lastPlayed: null,
    favorite: false,
    notes: null,
    tags: [],
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

const baseParams: TodayPlayParams = {
  playerCount: 3,
  availableTime: 90,
  desiredComplexity: 2.5,
};

describe("recommendation engine", () => {
  describe("player count filtering", () => {
    it("filters out games that don't support the player count", () => {
      const games = [
        makeGame({ id: 1, name: "2-Player Only", minPlayers: 2, maxPlayers: 2 }),
        makeGame({ id: 2, name: "3-4 Players", minPlayers: 3, maxPlayers: 4 }),
      ];

      const results = recommendGames(games, { ...baseParams, playerCount: 3 });

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("3-4 Players");
    });

    it("includes games where player count is within range", () => {
      const games = [
        makeGame({ id: 1, name: "Wide Range", minPlayers: 1, maxPlayers: 8 }),
      ];

      const results = recommendGames(games, { ...baseParams, playerCount: 5 });

      expect(results).toHaveLength(1);
      expect(results[0].score).toBeGreaterThan(0);
    });

    it("gives 0 score to games below minPlayers", () => {
      const games = [
        makeGame({ id: 1, minPlayers: 4, maxPlayers: 6 }),
      ];

      const results = recommendGames(games, { ...baseParams, playerCount: 2 });

      expect(results).toHaveLength(0);
    });
  });

  describe("mood filter", () => {
    it("relaxed mood boosts low-complexity short games", () => {
      const relaxedGame = makeGame({ id: 1, name: "Chill", averageWeight: 1.5, playingTime: 30 });
      const heavyGame = makeGame({ id: 2, name: "Heavy", averageWeight: 4.0, playingTime: 180 });

      const relaxedResults = recommendGames([relaxedGame, heavyGame], {
        ...baseParams,
        mood: "relaxed",
      });

      const chillScore = relaxedResults.find((g) => g.name === "Chill")!;
      const heavyScore = relaxedResults.find((g) => g.name === "Heavy");

      expect(chillScore.scoreBreakdown.moodBonus).toBeGreaterThan(0);
      // Heavy game may still appear but with 0 mood bonus
      if (heavyScore) {
        expect(heavyScore.scoreBreakdown.moodBonus).toBe(0);
      }
    });

    it("competitive mood boosts high-complexity long games", () => {
      const game = makeGame({ id: 1, averageWeight: 3.5, playingTime: 120 });

      const results = recommendGames([game], {
        ...baseParams,
        mood: "competitive",
      });

      expect(results[0].scoreBreakdown.moodBonus).toBeGreaterThan(0);
    });

    it("creative mood boosts Worker Placement and Engine Building", () => {
      const wpGame = makeGame({ id: 1, name: "WP", mechanics: ["Worker Placement"] });
      const ebGame = makeGame({ id: 2, name: "EB", mechanics: ["Engine Building"] });
      const plainGame = makeGame({ id: 3, name: "Plain", mechanics: ["Dice Rolling"] });

      const results = recommendGames([wpGame, ebGame, plainGame], {
        ...baseParams,
        mood: "creative",
      });

      const wp = results.find((g) => g.name === "WP")!;
      const eb = results.find((g) => g.name === "EB")!;
      const plain = results.find((g) => g.name === "Plain")!;

      expect(wp.scoreBreakdown.moodBonus).toBe(15);
      expect(eb.scoreBreakdown.moodBonus).toBe(15);
      expect(plain.scoreBreakdown.moodBonus).toBe(0);
    });

    it("no mood means no mood bonus", () => {
      const game = makeGame({ id: 1 });
      const results = recommendGames([game], baseParams);

      expect(results[0].scoreBreakdown.moodBonus).toBe(0);
    });

    it("mood changes ranking order", () => {
      const simpleGame = makeGame({
        id: 1,
        name: "Simple",
        averageWeight: 1.5,
        playingTime: 30,
        mechanics: ["Dice Rolling"],
      });
      const complexGame = makeGame({
        id: 2,
        name: "Complex",
        averageWeight: 3.5,
        playingTime: 120,
        mechanics: ["Worker Placement"],
      });

      // Without mood
      const noMood = recommendGames([simpleGame, complexGame], baseParams);
      const noMoodOrder = noMood.map((g) => g.name);

      // With relaxed mood
      const relaxed = recommendGames([simpleGame, complexGame], {
        ...baseParams,
        desiredComplexity: 2.0,
        mood: "relaxed",
      });
      const relaxedFirst = relaxed[0].name;

      expect(relaxedFirst).toBe("Simple");
    });
  });

  describe("combined filter (players + mood)", () => {
    it("applies both player filter and mood bonus", () => {
      const games = [
        makeGame({ id: 1, name: "Party Chill", minPlayers: 2, maxPlayers: 6, averageWeight: 1.5, playingTime: 30 }),
        makeGame({ id: 2, name: "Solo Heavy", minPlayers: 1, maxPlayers: 1, averageWeight: 4.0, playingTime: 180 }),
        makeGame({ id: 3, name: "Party Heavy", minPlayers: 3, maxPlayers: 5, averageWeight: 4.0, playingTime: 180 }),
      ];

      const results = recommendGames(games, {
        playerCount: 4,
        availableTime: 60,
        desiredComplexity: 2.0,
        mood: "relaxed",
      });

      // Solo Heavy should be filtered out (player count doesn't fit)
      expect(results.find((g) => g.name === "Solo Heavy")).toBeUndefined();

      // Party Chill should rank highest (fits players, relaxed mood, fits time)
      expect(results[0].name).toBe("Party Chill");
      expect(results[0].scoreBreakdown.moodBonus).toBeGreaterThan(0);
    });
  });

  describe("maxGroupComplexity", () => {
    it("filters out games above group max complexity", () => {
      const easyGame = makeGame({ id: 1, name: "Easy", averageWeight: 1.5 });
      const hardGame = makeGame({ id: 2, name: "Hard", averageWeight: 3.5 });

      const results = recommendGames([easyGame, hardGame], {
        ...baseParams,
        maxGroupComplexity: 2.0,
      });

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("Easy");
    });

    it("caps desiredComplexity to maxGroupComplexity", () => {
      const game = makeGame({ id: 1, averageWeight: 1.8 });

      const results = recommendGames([game], {
        ...baseParams,
        desiredComplexity: 4.0,
        maxGroupComplexity: 2.0,
      });

      // Should still match since complexity is capped to 2.0,
      // and game is 1.8 (diff 0.2, within 0.3 threshold)
      expect(results).toHaveLength(1);
      expect(results[0].scoreBreakdown.complexityFit).toBeGreaterThan(0);
    });
  });

  describe("'Lange nicht gespielt' sorting", () => {
    it("gives higher bonus to games not played for >90 days", () => {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 91);

      const recentlyPlayed = makeGame({ id: 1, name: "Recent", lastPlayed: new Date().toISOString() });
      const longAgo = makeGame({ id: 2, name: "Long Ago", lastPlayed: ninetyDaysAgo.toISOString() });
      const neverPlayed = makeGame({ id: 3, name: "Never", lastPlayed: null });

      const results = recommendGames([recentlyPlayed, longAgo, neverPlayed], baseParams);

      const recent = results.find((g) => g.name === "Recent")!;
      const long = results.find((g) => g.name === "Long Ago")!;
      const never = results.find((g) => g.name === "Never")!;

      expect(never.scoreBreakdown.lastPlayedBonus).toBe(12);
      expect(long.scoreBreakdown.lastPlayedBonus).toBe(12);
      expect(recent.scoreBreakdown.lastPlayedBonus).toBe(0);
    });

    it("gives partial bonus for games played 15-30 days ago", () => {
      const twentyDaysAgo = new Date();
      twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 20);

      const game = makeGame({ id: 1, lastPlayed: twentyDaysAgo.toISOString() });
      const results = recommendGames([game], baseParams);

      expect(results[0].scoreBreakdown.lastPlayedBonus).toBe(6); // 12 * 0.5 = 6
    });
  });

  describe("categorizeResults", () => {
    it("puts favorites in 'favoriten' category", () => {
      const game = makeGame({ id: 1, name: "Fav", favorite: true, lastPlayed: new Date().toISOString() });
      const results = recommendGames([game], baseParams);
      const cats = categorizeResults(results);

      expect(cats.favoriten).toHaveLength(1);
      expect(cats.favoriten[0].name).toBe("Fav");
    });

    it("puts games not played for >30 days in 'langeNichtGespielt'", () => {
      const fortyDaysAgo = new Date();
      fortyDaysAgo.setDate(fortyDaysAgo.getDate() - 40);

      const game = makeGame({ id: 1, name: "Old", lastPlayed: fortyDaysAgo.toISOString() });
      const results = recommendGames([game], baseParams);
      const cats = categorizeResults(results);

      expect(cats.langeNichtGespielt).toHaveLength(1);
      expect(cats.langeNichtGespielt[0].name).toBe("Old");
    });

    it("puts never-played games in 'langeNichtGespielt'", () => {
      const game = makeGame({ id: 1, name: "New", lastPlayed: null });
      const results = recommendGames([game], baseParams);
      const cats = categorizeResults(results);

      expect(cats.langeNichtGespielt).toHaveLength(1);
    });

    it("puts non-favorite recently-played games in 'malWasAnderes'", () => {
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      const game = makeGame({ id: 1, name: "Recent", favorite: false, lastPlayed: tenDaysAgo.toISOString() });
      const results = recommendGames([game], baseParams);
      const cats = categorizeResults(results);

      expect(cats.malWasAnderes).toHaveLength(1);
      expect(cats.malWasAnderes[0].name).toBe("Recent");
    });

    it("limits each category to 5 games", () => {
      const games = Array.from({ length: 10 }, (_, i) =>
        makeGame({ id: i + 1, name: `Game ${i}`, favorite: true, lastPlayed: null })
      );
      const results = recommendGames(games, baseParams);
      const cats = categorizeResults(results);

      expect(cats.favoriten.length).toBeLessThanOrEqual(5);
      expect(cats.langeNichtGespielt.length).toBeLessThanOrEqual(5);
    });
  });

  describe("calcMoodBonus", () => {
    it("returns 0 when no mood is set", () => {
      const game = makeGame();
      expect(calcMoodBonus(game, undefined)).toBe(0);
    });

    it("relaxed: full bonus for low complexity + short time", () => {
      const game = makeGame({ averageWeight: 1.5, playingTime: 30 });
      expect(calcMoodBonus(game, "relaxed")).toBe(15); // 0.6*15 + 0.4*15
    });

    it("relaxed: partial bonus for only low complexity", () => {
      const game = makeGame({ averageWeight: 1.5, playingTime: 120 });
      expect(calcMoodBonus(game, "relaxed")).toBe(9); // 0.6*15 = 9
    });

    it("competitive: full bonus for high complexity + long time", () => {
      const game = makeGame({ averageWeight: 3.5, playingTime: 120 });
      expect(calcMoodBonus(game, "competitive")).toBe(15);
    });

    it("creative: full bonus for Worker Placement mechanic", () => {
      const game = makeGame({ mechanics: ["Worker Placement"] });
      expect(calcMoodBonus(game, "creative")).toBe(15);
    });

    it("creative: 0 for non-creative mechanics", () => {
      const game = makeGame({ mechanics: ["Dice Rolling"] });
      expect(calcMoodBonus(game, "creative")).toBe(0);
    });
  });

  describe("score normalization", () => {
    it("scores are between 0 and 100", () => {
      const games = [
        makeGame({ id: 1, favorite: true, averageWeight: 2.5, playingTime: 60 }),
        makeGame({ id: 2, averageWeight: 1.0, playingTime: 200 }),
      ];

      const results = recommendGames(games, { ...baseParams, mood: "relaxed" });

      for (const r of results) {
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(100);
      }
    });
  });

  describe("only owned games", () => {
    it("excludes non-owned games", () => {
      const games = [
        makeGame({ id: 1, name: "Owned", owned: true }),
        makeGame({ id: 2, name: "Not Owned", owned: false }),
      ];

      const results = recommendGames(games, baseParams);

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("Owned");
    });
  });
});
