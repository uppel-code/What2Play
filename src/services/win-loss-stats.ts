/**
 * Win/Loss Statistics Service — Pure computation functions
 *
 * Per-game stats for game detail page + global stats for profile/year-review.
 */

import type { Game, PlaySession, Player } from "@/types/game";

// ─── Per-Game Stats ───

export interface PlayerWinRate {
  player: Player;
  wins: number;
  total: number;
  rate: number; // 0–100
}

export interface GameStats {
  totalPlayed: number;
  winRateByPlayer: PlayerWinRate[];
  mostCommonResult: string;
  lastSession: {
    playedAt: string;
    winnerName: string | null;
    duration: number;
  } | null;
  averageDuration: number;
}

export function computeGameStats(
  sessions: PlaySession[],
  players: Player[],
): GameStats {
  const totalPlayed = sessions.length;

  if (totalPlayed === 0) {
    return {
      totalPlayed: 0,
      winRateByPlayer: [],
      mostCommonResult: "–",
      lastSession: null,
      averageDuration: 0,
    };
  }

  // Win rate by player
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const winCounts = new Map<number, number>();
  const participationCounts = new Map<number, number>();

  for (const s of sessions) {
    if (s.winnerId != null) {
      winCounts.set(s.winnerId, (winCounts.get(s.winnerId) || 0) + 1);
    }
    // Count all sessions as potential participation for known winners
    if (s.winnerId != null) {
      participationCounts.set(s.winnerId, (participationCounts.get(s.winnerId) || 0) + 1);
    }
  }

  // Build win rate for players who have at least one win
  const winRateByPlayer: PlayerWinRate[] = [];
  for (const [playerId, wins] of winCounts) {
    const player = playerMap.get(playerId);
    if (!player) continue;
    winRateByPlayer.push({
      player,
      wins,
      total: totalPlayed,
      rate: Math.round((wins / totalPlayed) * 100),
    });
  }
  winRateByPlayer.sort((a, b) => b.wins - a.wins);

  // Most common result (most frequent winner)
  let mostCommonResult = "Kein Gewinner";
  if (winRateByPlayer.length > 0) {
    mostCommonResult = `${winRateByPlayer[0].player.name} gewinnt`;
  }

  // Last session
  const sorted = [...sessions].sort((a, b) => b.playedAt.localeCompare(a.playedAt));
  const last = sorted[0];
  const lastWinner = last.winnerId != null ? playerMap.get(last.winnerId) : null;
  const lastSession = {
    playedAt: last.playedAt,
    winnerName: lastWinner?.name ?? null,
    duration: last.duration,
  };

  // Average duration
  const totalDuration = sessions.reduce((sum, s) => sum + s.duration, 0);
  const averageDuration = Math.round(totalDuration / totalPlayed);

  return {
    totalPlayed,
    winRateByPlayer,
    mostCommonResult,
    lastSession,
    averageDuration,
  };
}

// ─── Global Stats ───

export interface GlobalStats {
  totalSessions: number;
  uniqueGames: number;
  bestPlayer: { player: Player; wins: number } | null;
  favoriteGame: { game: Game; count: number } | null;
  winStreak: { player: Player; streak: number } | null;
}

export function computeGlobalStats(
  sessions: PlaySession[],
  games: Game[],
  players: Player[],
): GlobalStats {
  const totalSessions = sessions.length;
  const uniqueGames = new Set(sessions.map((s) => s.gameId)).size;

  // Best player (most wins overall)
  const winCounts = new Map<number, number>();
  for (const s of sessions) {
    if (s.winnerId != null) {
      winCounts.set(s.winnerId, (winCounts.get(s.winnerId) || 0) + 1);
    }
  }

  let bestPlayer: GlobalStats["bestPlayer"] = null;
  const playerMap = new Map(players.map((p) => [p.id, p]));
  for (const [pid, wins] of winCounts) {
    const player = playerMap.get(pid);
    if (player && (!bestPlayer || wins > bestPlayer.wins)) {
      bestPlayer = { player, wins };
    }
  }

  // Favorite game (most sessions)
  const gameCounts = new Map<number, number>();
  for (const s of sessions) {
    gameCounts.set(s.gameId, (gameCounts.get(s.gameId) || 0) + 1);
  }

  let favoriteGame: GlobalStats["favoriteGame"] = null;
  const gameMap = new Map(games.map((g) => [g.id, g]));
  for (const [gid, count] of gameCounts) {
    const game = gameMap.get(gid);
    if (game && (!favoriteGame || count > favoriteGame.count)) {
      favoriteGame = { game, count };
    }
  }

  // Win streak (longest consecutive wins by same player, sorted by date)
  let winStreak: GlobalStats["winStreak"] = null;
  if (sessions.length > 0) {
    const sorted = [...sessions].sort((a, b) => a.playedAt.localeCompare(b.playedAt));
    let currentStreak = 1;
    let currentPlayer = sorted[0].winnerId;
    let bestStreakLength = 0;
    let bestStreakPlayer: number | null = null;

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].winnerId != null && sorted[i].winnerId === currentPlayer) {
        currentStreak++;
      } else {
        if (currentPlayer != null && currentStreak > bestStreakLength) {
          bestStreakLength = currentStreak;
          bestStreakPlayer = currentPlayer;
        }
        currentPlayer = sorted[i].winnerId;
        currentStreak = 1;
      }
    }
    // Check final streak
    if (currentPlayer != null && currentStreak > bestStreakLength) {
      bestStreakLength = currentStreak;
      bestStreakPlayer = currentPlayer;
    }

    if (bestStreakPlayer != null && bestStreakLength >= 2) {
      const player = playerMap.get(bestStreakPlayer);
      if (player) {
        winStreak = { player, streak: bestStreakLength };
      }
    }
  }

  return {
    totalSessions,
    uniqueGames,
    bestPlayer,
    favoriteGame,
    winStreak,
  };
}
