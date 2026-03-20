import type { Game, TodayPlayParams, ScoredGame, ScoreBreakdown, Mood, CategorizedRecommendations } from "@/types/game";

/**
 * Recommendation Engine for "Heute spielen" mode.
 *
 * Scoring breakdown (max ~115 points, normalized to 100):
 * - Player count fit:    0–35 points
 * - Time fit:            0–25 points
 * - Complexity fit:      0–18 points
 * - Favorite bonus:         +5 points
 * - "Long not played" bonus: +12 points
 * - Tag bonus:              +5 points
 * - Mood bonus:             +15 points
 */

const WEIGHTS = {
  playerFit: 35,
  timeFit: 25,
  complexityFit: 18,
  favoriteBonus: 5,
  lastPlayedBonus: 12,
  tagBonus: 5,
  moodBonus: 15,
} as const;

const CREATIVE_MECHANICS = [
  "Worker Placement",
  "Engine Building",
];

export function recommendGames(
  games: Game[],
  params: TodayPlayParams,
): ScoredGame[] {
  const effectiveParams = applyGroupConstraints(params);

  const scored = games
    .filter((g) => g.owned)
    .map((game) => scoreGame(game, effectiveParams))
    .filter((sg) => sg.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored;
}

/** Categorize scored results into thematic sections */
export function categorizeResults(scored: ScoredGame[]): CategorizedRecommendations {
  const langeNichtGespielt: ScoredGame[] = [];
  const favoriten: ScoredGame[] = [];
  const malWasAnderes: ScoredGame[] = [];

  for (const game of scored) {
    const daysSince = game.lastPlayed
      ? daysBetween(new Date(game.lastPlayed), new Date())
      : Infinity;

    if (game.favorite) {
      favoriten.push(game);
    }

    if (daysSince > 30) {
      langeNichtGespielt.push(game);
    }

    // "Mal was anderes": not a favorite and played within last 90 days or never,
    // i.e. games that are neither favorites nor long-forgotten
    if (!game.favorite && daysSince <= 90) {
      malWasAnderes.push(game);
    }
  }

  return {
    langeNichtGespielt: langeNichtGespielt.slice(0, 5),
    favoriten: favoriten.slice(0, 5),
    malWasAnderes: malWasAnderes.slice(0, 5),
  };
}

/** Apply PlayGroup constraints: cap complexity at group's max */
function applyGroupConstraints(params: TodayPlayParams): TodayPlayParams {
  if (params.maxGroupComplexity == null) return params;
  return {
    ...params,
    desiredComplexity: Math.min(params.desiredComplexity, params.maxGroupComplexity),
  };
}

function scoreGame(game: Game, params: TodayPlayParams): ScoredGame {
  const breakdown: ScoreBreakdown = {
    playerFit: calcPlayerFit(game, params.playerCount),
    timeFit: calcTimeFit(game, params.availableTime),
    complexityFit: calcComplexityFit(game, params.desiredComplexity),
    favoriteBonus: calcFavoriteBonus(game),
    lastPlayedBonus: calcLastPlayedBonus(game),
    tagBonus: calcTagBonus(game, params),
    moodBonus: calcMoodBonus(game, params.mood),
  };

  // Hard filter: if player count doesn't fit, score is 0
  if (breakdown.playerFit === 0) {
    return { ...game, score: 0, scoreBreakdown: breakdown };
  }

  // Cap complexity for group
  if (params.maxGroupComplexity != null && game.averageWeight > params.maxGroupComplexity) {
    return { ...game, score: 0, scoreBreakdown: breakdown };
  }

  const rawScore =
    breakdown.playerFit +
    breakdown.timeFit +
    breakdown.complexityFit +
    breakdown.favoriteBonus +
    breakdown.lastPlayedBonus +
    breakdown.tagBonus +
    breakdown.moodBonus;

  // Normalize to 0-100 scale
  const maxPossible = WEIGHTS.playerFit + WEIGHTS.timeFit + WEIGHTS.complexityFit +
    WEIGHTS.favoriteBonus + WEIGHTS.lastPlayedBonus + WEIGHTS.tagBonus + WEIGHTS.moodBonus;
  // BUG-25: Clamp score to 0-100
  const score = Math.min(100, Math.round((rawScore / maxPossible) * 100));

  return { ...game, score, scoreBreakdown: breakdown };
}

/** Player count: full points if exact match, partial if in range, 0 if outside */
function calcPlayerFit(game: Game, playerCount: number): number {
  if (playerCount < game.minPlayers || playerCount > game.maxPlayers) {
    return 0;
  }

  const range = game.maxPlayers - game.minPlayers;
  if (range === 0) {
    return WEIGHTS.playerFit;
  }

  const mid = (game.minPlayers + game.maxPlayers) / 2;
  const distFromMid = Math.abs(playerCount - mid) / (range / 2);
  return Math.round(WEIGHTS.playerFit * (1 - distFromMid * 0.3));
}

/** Time: full points if game fits in available time, scaled down if close */
function calcTimeFit(game: Game, availableTime: number): number {
  const gameTime = game.playingTime;

  if (gameTime <= 0) return WEIGHTS.timeFit * 0.5;

  if (gameTime <= availableTime) {
    const usage = gameTime / availableTime;
    if (usage >= 0.5) return WEIGHTS.timeFit;
    if (usage >= 0.3) return Math.round(WEIGHTS.timeFit * 0.8);
    return Math.round(WEIGHTS.timeFit * 0.5);
  }

  const overrun = gameTime / availableTime;
  if (overrun <= 1.2) return Math.round(WEIGHTS.timeFit * 0.3);
  return 0;
}

/** Complexity: full points if exact match, drops off with distance */
function calcComplexityFit(game: Game, desired: number): number {
  const diff = Math.abs(game.averageWeight - desired);

  if (diff <= 0.3) return WEIGHTS.complexityFit;
  if (diff <= 0.7) return Math.round(WEIGHTS.complexityFit * 0.8);
  if (diff <= 1.2) return Math.round(WEIGHTS.complexityFit * 0.5);
  if (diff <= 2.0) return Math.round(WEIGHTS.complexityFit * 0.2);
  return 0;
}

/** Favorite: small bonus */
function calcFavoriteBonus(game: Game): number {
  return game.favorite ? WEIGHTS.favoriteBonus : 0;
}

/** Long not played: bonus if >14 days since last play, scaled by time */
function calcLastPlayedBonus(game: Game): number {
  if (!game.lastPlayed) return WEIGHTS.lastPlayedBonus;
  const daysSince = daysBetween(new Date(game.lastPlayed), new Date());
  if (daysSince > 90) return WEIGHTS.lastPlayedBonus;
  if (daysSince > 30) return Math.round(WEIGHTS.lastPlayedBonus * 0.75);
  if (daysSince > 14) return Math.round(WEIGHTS.lastPlayedBonus * 0.5);
  return 0;
}

/** Tag bonus: if newcomer preference matches tags */
function calcTagBonus(game: Game, params: TodayPlayParams): number {
  if (params.preferNewcomers && game.tags.includes("good-with-newcomers")) {
    return WEIGHTS.tagBonus;
  }
  if (game.tags.includes("quick-to-explain")) {
    return Math.round(WEIGHTS.tagBonus * 0.5);
  }
  return 0;
}

/** Mood bonus: reward games that match the selected mood */
export function calcMoodBonus(game: Game, mood?: Mood): number {
  if (!mood) return 0;

  switch (mood) {
    case "relaxed": {
      let bonus = 0;
      if (game.averageWeight <= 2.0) bonus += WEIGHTS.moodBonus * 0.6;
      if (game.playingTime > 0 && game.playingTime <= 60) bonus += WEIGHTS.moodBonus * 0.4;
      return Math.round(bonus);
    }
    case "competitive": {
      let bonus = 0;
      if (game.averageWeight >= 3.0) bonus += WEIGHTS.moodBonus * 0.6;
      if (game.playingTime >= 90) bonus += WEIGHTS.moodBonus * 0.4;
      return Math.round(bonus);
    }
    case "creative": {
      const hasCreativeMechanic = game.mechanics.some((m) =>
        CREATIVE_MECHANICS.some((cm) => m.includes(cm))
      );
      return hasCreativeMechanic ? WEIGHTS.moodBonus : 0;
    }
    default:
      return 0;
  }
}

export function daysBetween(a: Date, b: Date): number {
  const ms = Math.abs(b.getTime() - a.getTime());
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}
