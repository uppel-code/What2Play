"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import type { Game, PlaySession, Player } from "@/types/game";
import { getAllGames, getAllSessions, getAllPlayers } from "@/lib/db-client";
import {
  computeLeaderboard,
  computeMyStats,
} from "@/services/leaderboard";
import type { LeaderboardEntry, MyStats } from "@/services/leaderboard";

type SortField = "wins" | "winRate";

export default function LeaderboardPage() {
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myStats, setMyStats] = useState<MyStats | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortField>("wins");
  const [sessions, setSessions] = useState<PlaySession[]>([]);
  const [myPlayerId, setMyPlayerId] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([getAllGames(), getAllSessions(), getAllPlayers()])
      .then(([games, sess, players]) => {
        setSessions(sess);
        const board = computeLeaderboard(sess, games, players);
        setLeaderboard(board);

        // Auto-detect "me" as the first player (or player named "Ich")
        const me = players.find((p) => p.name.toLowerCase() === "ich") ?? players[0];
        if (me) {
          setMyPlayerId(me.id);
          setMyStats(computeMyStats(me.id, sess, board));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const sorted = useMemo(() => {
    let result = [...leaderboard];
    if (sortBy === "winRate") {
      result.sort((a, b) => b.winRate - a.winRate || b.wins - a.wins);
      // Re-assign rank for winRate sort
      for (let i = 0; i < result.length; i++) {
        if (i === 0) {
          result[i] = { ...result[i], rank: 1 };
        } else if (
          result[i].winRate === result[i - 1].winRate &&
          result[i].wins === result[i - 1].wins
        ) {
          result[i] = { ...result[i], rank: result[i - 1].rank };
        } else {
          result[i] = { ...result[i], rank: i + 1 };
        }
      }
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((e) => e.player.name.toLowerCase().includes(q));
    }
    return result;
  }, [leaderboard, sortBy, search]);

  const handleSortToggle = useCallback(
    (field: SortField) => setSortBy(field),
    [],
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-forest border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-warm-200/40 bg-surface/90 backdrop-blur-xl dark:border-warm-700/30 dark:bg-warm-900/95">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <Link
            href="/"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-warm-100 text-warm-600 transition-colors hover:bg-warm-200 dark:bg-warm-800 dark:text-warm-400"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="font-display text-lg font-bold text-warm-900">Leaderboard</h1>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pt-4 space-y-5">
        {/* My Stats Card */}
        {myStats && myStats.rank > 0 && (
          <div
            data-testid="my-stats-card"
            className="rounded-2xl bg-gradient-to-br from-forest/10 to-forest/5 p-4 ring-1 ring-forest/20 dark:from-forest/20 dark:to-forest/10"
          >
            <h2 className="text-xs font-semibold text-forest uppercase tracking-wider mb-3">Meine Stats</h2>
            <div className="grid grid-cols-4 gap-3">
              <div className="text-center">
                <p className="text-[11px] font-medium text-warm-500">Rang</p>
                <p className="mt-0.5 font-display text-xl font-bold text-warm-900">
                  #{myStats.rank}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[11px] font-medium text-warm-500">Siege</p>
                <p className="mt-0.5 font-display text-xl font-bold text-forest">{myStats.wins}</p>
              </div>
              <div className="text-center">
                <p className="text-[11px] font-medium text-warm-500">Win Rate</p>
                <p className="mt-0.5 font-display text-xl font-bold text-warm-900">{myStats.winRate}%</p>
              </div>
              <div className="text-center">
                <p className="text-[11px] font-medium text-warm-500">Best Streak</p>
                <p className="mt-0.5 font-display text-xl font-bold text-amber-600">{myStats.bestStreak}</p>
              </div>
            </div>
          </div>
        )}

        {/* Search & Sort */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-warm-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Spieler suchen..."
              data-testid="player-search"
              className="w-full rounded-xl border border-warm-200 bg-warm-50/50 py-2.5 pl-9 pr-3 text-sm text-warm-800 placeholder:text-warm-400 focus:border-forest focus:bg-surface focus:outline-none focus:ring-2 focus:ring-forest/10 dark:border-warm-700 dark:bg-warm-800 dark:text-warm-200"
            />
          </div>
          <div className="flex rounded-xl border border-warm-200 bg-warm-50/50 dark:border-warm-700 dark:bg-warm-800">
            <button
              onClick={() => handleSortToggle("wins")}
              data-testid="sort-wins"
              className={`rounded-l-xl px-3 py-2 text-xs font-semibold transition-colors ${
                sortBy === "wins"
                  ? "bg-forest text-white"
                  : "text-warm-500 hover:text-warm-700"
              }`}
            >
              Siege
            </button>
            <button
              onClick={() => handleSortToggle("winRate")}
              data-testid="sort-winrate"
              className={`rounded-r-xl px-3 py-2 text-xs font-semibold transition-colors ${
                sortBy === "winRate"
                  ? "bg-forest text-white"
                  : "text-warm-500 hover:text-warm-700"
              }`}
            >
              Win Rate
            </button>
          </div>
        </div>

        {/* Leaderboard Table */}
        {sorted.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-4xl mb-3">🏆</p>
            <p className="text-sm text-warm-500">
              {leaderboard.length === 0
                ? "Noch keine Spiele gespielt. Starte eine Partie!"
                : "Kein Spieler gefunden."}
            </p>
          </div>
        ) : (
          <div className="space-y-2" data-testid="leaderboard-table">
            {sorted.map((entry) => {
              const isTop3 = entry.rank <= 3;
              const rankEmoji =
                entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : null;

              return (
                <Link
                  key={entry.player.id}
                  href={`/player?id=${entry.player.id}`}
                  data-testid={`leaderboard-row-${entry.player.id}`}
                  className={`flex items-center gap-3 rounded-2xl border p-3 transition-all hover:shadow-md active:scale-[0.99] ${
                    isTop3
                      ? "border-forest/20 bg-forest/5 dark:border-forest/30 dark:bg-forest/10"
                      : "border-warm-200/80 bg-surface dark:border-warm-700"
                  }`}
                >
                  {/* Rank */}
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-warm-100 font-display font-bold text-warm-700 dark:bg-warm-800 dark:text-warm-300">
                    {rankEmoji ?? `#${entry.rank}`}
                  </div>

                  {/* Player Info */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${isTop3 ? "text-forest dark:text-green-400" : "text-warm-900"}`}>
                      {entry.player.name}
                    </p>
                    {entry.favoriteGame && (
                      <p className="text-[11px] text-warm-500 truncate">
                        Lieblingsspiel: {entry.favoriteGame.game.name}
                      </p>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-right flex-shrink-0">
                    <div>
                      <p className="text-xs font-bold text-forest">{entry.wins}W</p>
                      <p className="text-[10px] text-warm-400">{entry.losses}L</p>
                    </div>
                    <div className="w-12">
                      <p className="text-sm font-bold text-warm-900">{entry.winRate}%</p>
                    </div>
                    <svg className="h-4 w-4 text-warm-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
