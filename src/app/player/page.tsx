"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Game, PlaySession, Player } from "@/types/game";
import { getAllGames, getAllSessions, getAllPlayers } from "@/lib/db-client";
import { computePlayerDetailStats } from "@/services/leaderboard";
import type { PlayerDetailStats } from "@/services/leaderboard";
import PieChart, { getPieColors } from "@/components/PieChart";
import BarChart from "@/components/BarChart";

function PlayerDetailContent() {
  const searchParams = useSearchParams();
  const id = Number(searchParams.get("id"));
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<PlayerDetailStats | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    Promise.all([getAllGames(), getAllSessions(), getAllPlayers()])
      .then(([games, sessions, players]) => {
        const player = players.find((p) => p.id === id);
        if (player) {
          setStats(computePlayerDetailStats(player, sessions, games, players));
        }
      })
      .catch(() => {
        // Player data load failed — stats stays null, 404 UI shown
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-forest border-t-transparent" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <p className="text-4xl">😕</p>
        <p className="text-sm text-warm-500">Spieler nicht gefunden.</p>
        <Link href="/leaderboard" className="text-sm font-medium text-forest hover:underline">
          Zurück zum Leaderboard
        </Link>
      </div>
    );
  }

  const rankEmoji =
    stats.rank === 1 ? "🥇" : stats.rank === 2 ? "🥈" : stats.rank === 3 ? "🥉" : null;

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-warm-200/40 bg-surface/90 backdrop-blur-xl dark:border-warm-700/30 dark:bg-warm-900/95">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <Link
            href="/leaderboard"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-warm-100 text-warm-600 transition-colors hover:bg-warm-200 dark:bg-warm-800 dark:text-warm-400"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="font-display text-lg font-bold text-warm-900 truncate">{stats.player.name}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pt-4 space-y-5">
        {/* Player Hero */}
        <div
          data-testid="player-hero"
          className="rounded-2xl bg-gradient-to-br from-forest/10 to-forest/5 p-5 ring-1 ring-forest/20 text-center dark:from-forest/20 dark:to-forest/10"
        >
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="text-3xl">{rankEmoji ?? "🏅"}</span>
            <span className="font-display text-2xl font-bold text-warm-900">
              {stats.player.name}
            </span>
          </div>
          <p className="text-sm text-warm-500 mb-4">
            Rang #{stats.rank} {stats.rank <= 3 ? " — Top Spieler!" : ""}
          </p>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <p className="text-[11px] font-medium text-warm-500">Siege</p>
              <p className="font-display text-xl font-bold text-forest">{stats.wins}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-warm-500">Niederlagen</p>
              <p className="font-display text-xl font-bold text-coral">{stats.losses}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-warm-500">Win Rate</p>
              <p className="font-display text-xl font-bold text-warm-900">{stats.winRate}%</p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-warm-500">Streak</p>
              <p className="font-display text-xl font-bold text-amber-600">{stats.bestStreak}</p>
            </div>
          </div>
        </div>

        {/* Favorite Game */}
        {stats.favoriteGame && (
          <div className="rounded-2xl border border-warm-200/80 bg-surface p-4 dark:border-warm-700">
            <h3 className="text-xs font-semibold text-warm-500 uppercase tracking-wider mb-2">Lieblingsspiel</h3>
            <Link
              href={`/game?id=${stats.favoriteGame.game.id}`}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              {stats.favoriteGame.game.thumbnail ? (
                <img
                  src={stats.favoriteGame.game.thumbnail}
                  alt={stats.favoriteGame.game.name}
                  className="h-12 w-12 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-warm-100 text-xl dark:bg-warm-800">
                  🎲
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-warm-900">{stats.favoriteGame.game.name}</p>
                <p className="text-[11px] text-warm-500">{stats.favoriteGame.count} Siege</p>
              </div>
            </Link>
          </div>
        )}

        {/* Win/Loss Chart */}
        {stats.winsByGame.length > 0 && (
          <div className="rounded-2xl border border-warm-200/80 bg-surface p-4 dark:border-warm-700">
            <h3 className="text-xs font-semibold text-warm-500 uppercase tracking-wider mb-3">Siege pro Spiel</h3>
            <div className="flex flex-col items-center">
              <PieChart
                slices={stats.winsByGame.slice(0, 8).map((wg, i) => ({
                  label: wg.game.name,
                  value: wg.wins,
                  color: getPieColors(Math.min(stats.winsByGame.length, 8))[i],
                }))}
                size={180}
              />
            </div>
          </div>
        )}

        {/* Win Rate per Game (Bar Chart) */}
        {stats.winsByGame.length > 0 && (
          <div className="rounded-2xl border border-warm-200/80 bg-surface p-4 dark:border-warm-700">
            <h3 className="text-xs font-semibold text-warm-500 uppercase tracking-wider mb-3">Win Rate pro Spiel</h3>
            <BarChart
              bars={stats.winsByGame.slice(0, 8).map((wg) => ({
                label: wg.game.name,
                value: wg.total > 0 ? Math.round((wg.wins / wg.total) * 100) : 0,
                color: "#2D7A4F",
              }))}
              height={180}
            />
          </div>
        )}

        {/* Recent Sessions / History */}
        <div data-testid="player-history">
          <h3 className="text-xs font-semibold text-warm-500 uppercase tracking-wider mb-3">Letzte Partien</h3>
          {stats.recentSessions.length === 0 ? (
            <p className="text-sm text-warm-400 py-4 text-center">Noch keine Partien gespielt.</p>
          ) : (
            <div className="space-y-2">
              {stats.recentSessions.map((r) => (
                <Link
                  key={r.session.id}
                  href={`/game?id=${r.session.gameId}`}
                  className={`flex items-center gap-3 rounded-xl border p-3 transition-all hover:shadow-sm ${
                    r.won
                      ? "border-forest/20 bg-forest/5 dark:border-forest/30"
                      : "border-warm-200/80 bg-surface dark:border-warm-700"
                  }`}
                >
                  <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    r.won
                      ? "bg-forest/20 text-forest"
                      : "bg-warm-100 text-warm-500 dark:bg-warm-800"
                  }`}>
                    {r.won ? "W" : "L"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-warm-900 truncate">{r.game.name}</p>
                    <p className="text-[11px] text-warm-500">
                      {new Date(r.session.playedAt).toLocaleDateString("de-DE", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                      {r.session.duration > 0 && ` · ${r.session.duration} Min`}
                    </p>
                  </div>
                  {r.won && (
                    <span className="text-xs font-semibold text-forest">Sieg!</span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function PlayerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-forest border-t-transparent" />
        </div>
      }
    >
      <PlayerDetailContent />
    </Suspense>
  );
}
