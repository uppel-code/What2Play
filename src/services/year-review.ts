import type { Game, PlaySession, Player } from "@/types/game";

export interface YearReviewStats {
  year: number;
  totalGamesPlayed: number;
  mostPlayedGame: { game: Game; count: number } | null;
  newGamesAdded: number;
  shamePileCount: number;
  favoriteMitspieler: { player: Player; count: number } | null;
  favoriteMechanic: { mechanic: string; count: number } | null;
  activestMonth: { month: number; count: number } | null;
  longestStreak: number;
}

/**
 * Compute all year-review stats from raw data.
 */
export function computeYearReview(
  year: number,
  sessions: PlaySession[],
  games: Game[],
  players: Player[],
): YearReviewStats {
  const yearStr = String(year);
  const yearSessions = sessions.filter((s) => s.playedAt.startsWith(yearStr));

  const totalGamesPlayed = yearSessions.length;

  // Most played game
  const mostPlayedGame = computeMostPlayed(yearSessions, games);

  // New games added this year
  const newGamesAdded = games.filter((g) => g.createdAt.startsWith(yearStr)).length;

  // Shame pile: games that have never been played (no sessions at all)
  const playedGameIds = new Set(sessions.map((s) => s.gameId));
  const shamePileCount = games.filter((g) => !playedGameIds.has(g.id)).length;

  // Favorite Mitspieler (most frequent winnerId in year sessions)
  const favoriteMitspieler = computeFavoriteMitspieler(yearSessions, players);

  // Favorite mechanic
  const favoriteMechanic = computeFavoriteMechanic(yearSessions, games);

  // Activest month
  const activestMonth = computeActivestMonth(yearSessions);

  // Longest streak
  const longestStreak = computeLongestStreak(yearSessions);

  return {
    year,
    totalGamesPlayed,
    mostPlayedGame,
    newGamesAdded,
    shamePileCount,
    favoriteMitspieler,
    favoriteMechanic,
    activestMonth,
    longestStreak,
  };
}

export function computeMostPlayed(
  sessions: PlaySession[],
  games: Game[],
): { game: Game; count: number } | null {
  if (sessions.length === 0) return null;

  const counts = new Map<number, number>();
  for (const s of sessions) {
    counts.set(s.gameId, (counts.get(s.gameId) || 0) + 1);
  }

  let bestId: number | null = null;
  let bestCount = 0;
  for (const [gid, count] of counts) {
    if (count > bestCount) {
      bestId = gid;
      bestCount = count;
    }
  }

  const game = games.find((g) => g.id === bestId);
  if (!game) return null;
  return { game, count: bestCount };
}

export function computeFavoriteMitspieler(
  sessions: PlaySession[],
  players: Player[],
): { player: Player; count: number } | null {
  const counts = new Map<number, number>();
  for (const s of sessions) {
    if (s.winnerId != null) {
      counts.set(s.winnerId, (counts.get(s.winnerId) || 0) + 1);
    }
  }

  let bestId: number | null = null;
  let bestCount = 0;
  for (const [pid, count] of counts) {
    if (count > bestCount) {
      bestId = pid;
      bestCount = count;
    }
  }

  if (bestId === null) return null;
  const player = players.find((p) => p.id === bestId);
  if (!player) return null;
  return { player, count: bestCount };
}

export function computeFavoriteMechanic(
  sessions: PlaySession[],
  games: Game[],
): { mechanic: string; count: number } | null {
  const gameMap = new Map(games.map((g) => [g.id, g]));
  const counts = new Map<string, number>();

  for (const s of sessions) {
    const game = gameMap.get(s.gameId);
    if (!game) continue;
    for (const mech of game.mechanics) {
      counts.set(mech, (counts.get(mech) || 0) + 1);
    }
  }

  let best: string | null = null;
  let bestCount = 0;
  for (const [mech, count] of counts) {
    if (count > bestCount) {
      best = mech;
      bestCount = count;
    }
  }

  if (!best) return null;
  return { mechanic: best, count: bestCount };
}

export function computeActivestMonth(
  sessions: PlaySession[],
): { month: number; count: number } | null {
  if (sessions.length === 0) return null;

  const counts = new Map<number, number>();
  for (const s of sessions) {
    const month = new Date(s.playedAt).getMonth(); // 0-indexed
    counts.set(month, (counts.get(month) || 0) + 1);
  }

  let bestMonth = 0;
  let bestCount = 0;
  for (const [month, count] of counts) {
    if (count > bestCount) {
      bestMonth = month;
      bestCount = count;
    }
  }

  return { month: bestMonth, count: bestCount };
}

export function computeLongestStreak(sessions: PlaySession[]): number {
  if (sessions.length === 0) return 0;

  // Get unique sorted dates
  const uniqueDates = [...new Set(sessions.map((s) => s.playedAt))].sort();

  if (uniqueDates.length === 1) return 1;

  let longest = 1;
  let current = 1;

  for (let i = 1; i < uniqueDates.length; i++) {
    const prev = new Date(uniqueDates[i - 1]);
    const curr = new Date(uniqueDates[i]);
    const diffMs = curr.getTime() - prev.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      current++;
      if (current > longest) longest = current;
    } else {
      current = 1;
    }
  }

  return longest;
}

const MONTH_NAMES_DE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

export function monthName(month: number): string {
  return MONTH_NAMES_DE[month] ?? "";
}
