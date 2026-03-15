import type { GameParsed, TodayPlayParams, ScoredGame, ScoreBreakdown } from "@/types/game";

/**
 * Recommendation Engine for "Heute spielen" mode.
 *
 * Scoring breakdown (max 100 points):
 * - Player count fit:    0–35 points
 * - Time fit:            0–30 points
 * - Complexity fit:      0–20 points
 * - Favorite bonus:         +5 points
 * - "Long not played" bonus: +5 points
 * - Tag bonus:              +5 points
 */

const WEIGHTS = {
  playerFit: 35,
  timeFit: 30,
  complexityFit: 20,
  favoriteBonus: 5,
  lastPlayedBonus: 5,
  tagBonus: 5,
} as const;

export function recommendGames(
  games: GameParsed[],
  params: TodayPlayParams,
): ScoredGame[] {
  const scored = games
    .filter((g) => g.owned)
    .map((game) => scoreGame(game, params))
    .filter((sg) => sg.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored;
}

function scoreGame(game: GameParsed, params: TodayPlayParams): ScoredGame {
  const breakdown: ScoreBreakdown = {
    playerFit: calcPlayerFit(game, params.playerCount),
    timeFit: calcTimeFit(game, params.availableTime),
    complexityFit: calcComplexityFit(game, params.desiredComplexity),
    favoriteBonus: calcFavoriteBonus(game),
    lastPlayedBonus: calcLastPlayedBonus(game),
    tagBonus: calcTagBonus(game, params),
  };

  const score =
    breakdown.playerFit +
    breakdown.timeFit +
    breakdown.complexityFit +
    breakdown.favoriteBonus +
    breakdown.lastPlayedBonus +
    breakdown.tagBonus;

  return { ...game, score, scoreBreakdown: breakdown };
}

/** Player count: full points if exact match, partial if in range, 0 if outside */
function calcPlayerFit(game: GameParsed, playerCount: number): number {
  if (playerCount < game.minPlayers || playerCount > game.maxPlayers) {
    return 0; // Hard filter: not playable with this count
  }

  const range = game.maxPlayers - game.minPlayers;
  if (range === 0) {
    // Exact match game (e.g. exactly 2 players)
    return WEIGHTS.playerFit;
  }

  // Prefer games where playerCount is in the "sweet spot" (middle of range)
  const mid = (game.minPlayers + game.maxPlayers) / 2;
  const distFromMid = Math.abs(playerCount - mid) / (range / 2);
  return Math.round(WEIGHTS.playerFit * (1 - distFromMid * 0.3));
}

/** Time: full points if game fits in available time, scaled down if close */
function calcTimeFit(game: GameParsed, availableTime: number): number {
  const gameTime = game.playingTime;

  if (gameTime <= 0) return WEIGHTS.timeFit * 0.5; // Unknown duration: neutral

  if (gameTime <= availableTime) {
    // Game fits. Prefer games that use most of the time (not too short)
    const usage = gameTime / availableTime;
    if (usage >= 0.5) return WEIGHTS.timeFit;
    if (usage >= 0.3) return Math.round(WEIGHTS.timeFit * 0.8);
    return Math.round(WEIGHTS.timeFit * 0.5); // Very short game relative to time
  }

  // Game is too long: steep penalty
  const overrun = gameTime / availableTime;
  if (overrun <= 1.2) return Math.round(WEIGHTS.timeFit * 0.3); // Slightly over
  return 0; // Way too long
}

/** Complexity: full points if exact match, drops off with distance */
function calcComplexityFit(game: GameParsed, desired: number): number {
  const diff = Math.abs(game.averageWeight - desired);

  if (diff <= 0.3) return WEIGHTS.complexityFit;
  if (diff <= 0.7) return Math.round(WEIGHTS.complexityFit * 0.8);
  if (diff <= 1.2) return Math.round(WEIGHTS.complexityFit * 0.5);
  if (diff <= 2.0) return Math.round(WEIGHTS.complexityFit * 0.2);
  return 0;
}

/** Favorite: small bonus */
function calcFavoriteBonus(game: GameParsed): number {
  return game.favorite ? WEIGHTS.favoriteBonus : 0;
}

/** Long not played: bonus if >30 days since last play */
function calcLastPlayedBonus(game: GameParsed): number {
  if (!game.lastPlayed) return WEIGHTS.lastPlayedBonus; // Never played = bonus
  const daysSince = daysBetween(new Date(game.lastPlayed), new Date());
  if (daysSince > 90) return WEIGHTS.lastPlayedBonus;
  if (daysSince > 30) return Math.round(WEIGHTS.lastPlayedBonus * 0.6);
  return 0;
}

/** Tag bonus: if newcomer preference matches tags */
function calcTagBonus(game: GameParsed, params: TodayPlayParams): number {
  if (params.preferNewcomers && game.tags.includes("good-with-newcomers")) {
    return WEIGHTS.tagBonus;
  }
  if (game.tags.includes("quick-to-explain")) {
    return Math.round(WEIGHTS.tagBonus * 0.5);
  }
  return 0;
}

function daysBetween(a: Date, b: Date): number {
  const ms = Math.abs(b.getTime() - a.getTime());
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}
