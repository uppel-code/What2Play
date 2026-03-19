/**
 * Leaderboard Service — Pure computation functions
 *
 * Global player rankings, per-player stats, and head-to-head history.
 */

import type { Game, PlaySession, Player } from "@/types/game";

// ─── Leaderboard Entry ───

export interface LeaderboardEntry {
  player: Player;
  rank: number;
  wins: number;
  losses: number;
  winRate: number; // 0–100
  favoriteGame: { game: Game; count: number } | null;
  totalSessions: number;
}

export interface MyStats {
  rank: number;
  wins: number;
  winRate: number;
  bestStreak: number;
}

// ─── Player Detail Stats ───

export interface PlayerDetailStats {
  player: Player;
  rank: number;
  wins: number;
  losses: number;
  winRate: number;
  totalSessions: number;
  bestStreak: number;
  favoriteGame: { game: Game; count: number } | null;
  recentSessions: {
    session: PlaySession;
    game: Game;
    won: boolean;
  }[];
  winsByGame: { game: Game; wins: number; total: number }[];
}

// ─── Compute Leaderboard ───

export function computeLeaderboard(
  sessions: PlaySession[],
  games: Game[],
  players: Player[],
): LeaderboardEntry[] {
  if (players.length === 0 || sessions.length === 0) return [];

  const gameMap = new Map(games.map((g) => [g.id, g]));
  const entries: LeaderboardEntry[] = [];

  for (const player of players) {
    // Sessions where this player won
    const wins = sessions.filter((s) => s.winnerId === player.id).length;
    // Sessions where someone else won (loss for this player)
    const losses = sessions.filter(
      (s) => s.winnerId !== null && s.winnerId !== player.id,
    ).length;
    const totalSessions = sessions.length;
    const winRate = totalSessions > 0 ? Math.round((wins / totalSessions) * 100) : 0;

    // Favorite game: game this player won most
    const winsByGame = new Map<number, number>();
    for (const s of sessions) {
      if (s.winnerId === player.id) {
        winsByGame.set(s.gameId, (winsByGame.get(s.gameId) || 0) + 1);
      }
    }

    let favoriteGame: LeaderboardEntry["favoriteGame"] = null;
    for (const [gameId, count] of winsByGame) {
      const game = gameMap.get(gameId);
      if (game && (!favoriteGame || count > favoriteGame.count)) {
        favoriteGame = { game, count };
      }
    }

    entries.push({
      player,
      rank: 0, // assigned below
      wins,
      losses,
      winRate,
      favoriteGame,
      totalSessions,
    });
  }

  // Sort by wins descending, then winRate descending
  entries.sort((a, b) => b.wins - a.wins || b.winRate - a.winRate);

  // Assign ranks (1-based, ties get same rank)
  for (let i = 0; i < entries.length; i++) {
    if (i === 0) {
      entries[i].rank = 1;
    } else if (
      entries[i].wins === entries[i - 1].wins &&
      entries[i].winRate === entries[i - 1].winRate
    ) {
      entries[i].rank = entries[i - 1].rank;
    } else {
      entries[i].rank = i + 1;
    }
  }

  return entries;
}

// ─── Compute My Stats ───

export function computeMyStats(
  playerId: number,
  sessions: PlaySession[],
  leaderboard: LeaderboardEntry[],
): MyStats {
  const entry = leaderboard.find((e) => e.player.id === playerId);
  if (!entry) {
    return { rank: 0, wins: 0, winRate: 0, bestStreak: 0 };
  }

  const bestStreak = computeBestStreak(playerId, sessions);

  return {
    rank: entry.rank,
    wins: entry.wins,
    winRate: entry.winRate,
    bestStreak,
  };
}

// ─── Compute Best Streak for a Player ───

export function computeBestStreak(
  playerId: number,
  sessions: PlaySession[],
): number {
  if (sessions.length === 0) return 0;

  const sorted = [...sessions].sort((a, b) =>
    a.playedAt.localeCompare(b.playedAt),
  );

  let bestStreak = 0;
  let currentStreak = 0;

  for (const s of sorted) {
    if (s.winnerId === playerId) {
      currentStreak++;
      if (currentStreak > bestStreak) bestStreak = currentStreak;
    } else if (s.winnerId !== null) {
      currentStreak = 0;
    }
    // null winnerId doesn't break the streak
  }

  return bestStreak;
}

// ─── Compute Player Detail Stats ───

export function computePlayerDetailStats(
  player: Player,
  sessions: PlaySession[],
  games: Game[],
  allPlayers: Player[],
): PlayerDetailStats {
  const gameMap = new Map(games.map((g) => [g.id, g]));
  const leaderboard = computeLeaderboard(sessions, games, allPlayers);
  const entry = leaderboard.find((e) => e.player.id === player.id);

  const wins = sessions.filter((s) => s.winnerId === player.id).length;
  const losses = sessions.filter(
    (s) => s.winnerId !== null && s.winnerId !== player.id,
  ).length;
  const totalSessions = sessions.length;
  const winRate = totalSessions > 0 ? Math.round((wins / totalSessions) * 100) : 0;
  const bestStreak = computeBestStreak(player.id, sessions);

  // Recent sessions (last 10)
  const sorted = [...sessions].sort((a, b) =>
    b.playedAt.localeCompare(a.playedAt),
  );
  const recentSessions = sorted.slice(0, 10).map((s) => ({
    session: s,
    game: gameMap.get(s.gameId)!,
    won: s.winnerId === player.id,
  })).filter((r) => r.game != null);

  // Wins by game
  const gameWins = new Map<number, { wins: number; total: number }>();
  for (const s of sessions) {
    const current = gameWins.get(s.gameId) || { wins: 0, total: 0 };
    current.total++;
    if (s.winnerId === player.id) current.wins++;
    gameWins.set(s.gameId, current);
  }

  const winsByGame: PlayerDetailStats["winsByGame"] = [];
  for (const [gameId, data] of gameWins) {
    const game = gameMap.get(gameId);
    if (game) {
      winsByGame.push({ game, wins: data.wins, total: data.total });
    }
  }
  winsByGame.sort((a, b) => b.wins - a.wins);

  return {
    player,
    rank: entry?.rank ?? 0,
    wins,
    losses,
    winRate,
    totalSessions,
    bestStreak,
    favoriteGame: entry?.favoriteGame ?? null,
    recentSessions,
    winsByGame,
  };
}
