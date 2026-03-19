"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import GameCard from "@/components/GameCard";
import FilterBar from "@/components/FilterBar";
import QuickFilters from "@/components/QuickFilters";
import RandomPicker from "@/components/RandomPicker";
import type { Game, GameFilters, PlaySession } from "@/types/game";
import { getAllGames, deleteGame, getAllSessions, getPlayStats, getGameById } from "@/lib/db-client";
import Link from "next/link";

export default function CollectionPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [filters, setFilters] = useState<GameFilters>({});
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<PlaySession[]>([]);
  const [stats, setStats] = useState<{ totalPlayed: number; thisWeekCount: number; mostPlayedGameId: number | null; mostPlayedCount: number } | null>(null);
  const [mostPlayedGame, setMostPlayedGame] = useState<Game | null>(null);

  const handleDelete = useCallback(async (id: number) => {
    const game = games.find((g) => g.id === id);
    if (!game) return;
    const ok = window.confirm(`"${game.name}" wirklich loschen?`);
    if (!ok) return;
    await deleteGame(id);
    setGames((prev) => prev.filter((g) => g.id !== id));
  }, [games]);

  const loadGames = useCallback(async () => {
    try {
      const [data, allSessions, playStats] = await Promise.all([
        getAllGames(),
        getAllSessions(),
        getPlayStats(),
      ]);
      setGames(data);
      setSessions(allSessions);
      setStats(playStats);
      if (playStats.mostPlayedGameId) {
        const mpg = await getGameById(playStats.mostPlayedGameId);
        setMostPlayedGame(mpg ?? null);
      }
    } catch (error) {
      console.error("Failed to load games:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadGames();
  }, [loadGames]);

  // Re-fetch when page becomes visible (e.g. navigating back from /add)
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        loadGames();
      }
    }
    function handleFocus() {
      loadGames();
    }
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadGames]);

  const recentlyPlayed = useMemo(() => {
    if (sessions.length === 0) {
      // Fallback to lastPlayed field if no sessions yet
      return games
        .filter((g) => g.lastPlayed)
        .sort((a, b) => new Date(b.lastPlayed!).getTime() - new Date(a.lastPlayed!).getTime())
        .slice(0, 3);
    }
    // Use real session data: unique games, ordered by most recent session
    const seen = new Set<number>();
    const result: Game[] = [];
    for (const s of sessions) {
      if (seen.has(s.gameId)) continue;
      seen.add(s.gameId);
      const g = games.find((game) => game.id === s.gameId);
      if (g) result.push(g);
      if (result.length >= 3) break;
    }
    return result;
  }, [games, sessions]);

  const dustyCount = useMemo(() => {
    return games.filter((g) => !g.lastPlayed).length;
  }, [games]);

  const filteredGames = useMemo(() => {
    const result = games.filter((game) => {
      if (filters.search) {
        const search = filters.search.toLowerCase();
        if (!game.name.toLowerCase().includes(search)) return false;
      }
      if (filters.playerCount != null) {
        if (filters.playerCount < game.minPlayers || filters.playerCount > game.maxPlayers) return false;
      }
      if (filters.maxDuration != null) {
        if (game.playingTime > filters.maxDuration) return false;
      }
      if (filters.minComplexity != null) {
        if (game.averageWeight < filters.minComplexity) return false;
      }
      if (filters.maxComplexity != null) {
        if (game.averageWeight > filters.maxComplexity) return false;
      }
      if (filters.minAge != null) {
        if (game.minAge > filters.minAge) return false;
      }
      if (filters.tags && filters.tags.length > 0) {
        if (!filters.tags.some((tag) => game.tags.includes(tag))) return false;
      }
      if (filters.neverPlayed) {
        if (game.lastPlayed != null) return false;
      }
      if (filters.longNotPlayed) {
        if (!game.lastPlayed) return true; // never played counts as "lange her"
        const daysSince = (Date.now() - new Date(game.lastPlayed).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince <= 30) return false;
      }
      return true;
    });

    // Apply sorting
    if (filters.sortBy === "lastPlayed") {
      const dir = filters.sortDirection === "desc" ? -1 : 1;
      result.sort((a, b) => {
        // null lastPlayed = never played, sort to end for "newest first", start for "oldest first"
        if (!a.lastPlayed && !b.lastPlayed) return 0;
        if (!a.lastPlayed) return dir; // never played goes last (desc) or first (asc)
        if (!b.lastPlayed) return -dir;
        return dir * (new Date(a.lastPlayed).getTime() - new Date(b.lastPlayed).getTime());
      });
    }

    return result;
  }, [games, filters]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto" />
          <p className="mt-4 text-sm font-medium text-warm-500">Laden...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-warm-900">Meine Sammlung</h1>
          <p className="mt-1 text-sm font-medium text-warm-500">
            {games.length} Spiele in deinem Regal
            {dustyCount > 0 && (
              <span className="ml-2 text-warm-400">· {dustyCount} nie gespielt</span>
            )}
          </p>
        </div>
        {games.length > 0 && (
          <div className="flex items-center gap-2">
            <RandomPicker games={games} />
            <Link
              href="/manage"
              className="flex items-center gap-1.5 rounded-xl bg-warm-100 px-3 py-2 text-sm font-medium text-warm-600 transition-colors hover:bg-warm-200"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Verwalten
            </Link>
          </div>
        )}
      </div>

      <QuickFilters filters={filters} onChange={setFilters} />

      <div className="mt-3">
        <FilterBar filters={filters} onChange={setFilters} />
      </div>

      {/* Stats */}
      {stats && stats.totalPlayed > 0 && Object.keys(filters).length === 0 && (
        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-warm-50 p-3.5 text-center ring-1 ring-warm-200/40">
            <p className="text-[11px] font-semibold text-warm-500 uppercase tracking-wider">Gespielt</p>
            <p className="mt-1 font-display text-xl font-bold text-warm-900">{stats.totalPlayed}</p>
            <p className="text-[10px] text-warm-400">Partien gesamt</p>
          </div>
          <div className="rounded-xl bg-warm-50 p-3.5 text-center ring-1 ring-warm-200/40">
            <p className="text-[11px] font-semibold text-warm-500 uppercase tracking-wider">Diese Woche</p>
            <p className="mt-1 font-display text-xl font-bold text-forest">{stats.thisWeekCount}</p>
            <p className="text-[10px] text-warm-400">Partien</p>
          </div>
          <div className="rounded-xl bg-warm-50 p-3.5 text-center ring-1 ring-warm-200/40">
            <p className="text-[11px] font-semibold text-warm-500 uppercase tracking-wider">Meistgespielt</p>
            <p className="mt-1 font-display text-sm font-bold text-warm-900 line-clamp-1">
              {mostPlayedGame ? mostPlayedGame.name : "–"}
            </p>
            <p className="text-[10px] text-warm-400">{stats.mostPlayedCount}x gespielt</p>
          </div>
        </div>
      )}

      {/* Zuletzt gespielt */}
      {recentlyPlayed.length > 0 && Object.keys(filters).length === 0 && (
        <div className="mt-5">
          <h2 className="mb-3 font-display text-lg font-semibold text-warm-800">Zuletzt gespielt</h2>
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
            {recentlyPlayed.map((game) => (
              <Link
                key={game.id}
                href={`/game?id=${game.id}`}
                className="group flex w-28 shrink-0 flex-col items-center gap-2"
              >
                <div className="h-20 w-20 overflow-hidden rounded-2xl border border-warm-200/80 bg-warm-100 transition-transform group-hover:scale-105">
                  {game.thumbnail ? (
                    <img src={game.thumbnail} alt={game.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl text-warm-300">🎲</div>
                  )}
                </div>
                <span className="line-clamp-2 text-center text-xs font-medium text-warm-700">{game.name}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {filteredGames.length === 0 ? (
        <div className="mt-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-warm-100">
            <svg className="h-8 w-8 text-warm-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <p className="mt-4 font-display text-lg font-semibold text-warm-700">Keine Spiele gefunden</p>
          <p className="mt-1 text-sm text-warm-500">Versuch andere Filter oder erweitere deine Sammlung.</p>
          {Object.keys(filters).length > 1 && (
            <button
              onClick={() => setFilters({})}
              className="mt-4 text-sm font-medium text-forest hover:text-forest-dark"
            >
              Filter zurücksetzen
            </button>
          )}
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filteredGames.map((game, i) => (
            <div key={game.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}>
              <GameCard game={game} onDelete={handleDelete} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
