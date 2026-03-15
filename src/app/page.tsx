"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import GameCard from "@/components/GameCard";
import FilterBar from "@/components/FilterBar";
import type { Game, GameFilters } from "@/types/game";
import { getAllGames } from "@/lib/db-client";

export default function CollectionPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [filters, setFilters] = useState<GameFilters>({});
  const [loading, setLoading] = useState(true);

  const loadGames = useCallback(async () => {
    try {
      const data = await getAllGames();
      setGames(data);
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

  const filteredGames = useMemo(() => {
    return games.filter((game) => {
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
      return true;
    });
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
          <p className="mt-1 text-sm font-medium text-warm-500">{games.length} Spiele in deinem Regal</p>
        </div>
      </div>

      <FilterBar filters={filters} onChange={setFilters} />

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
              <GameCard game={game} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
