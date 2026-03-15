"use client";

import { useState, useEffect } from "react";
import ScoredGameCard from "@/components/ScoredGameCard";
import { recommendGames } from "@/services/recommendation";
import type { Game, GameParsed, TodayPlayParams, ScoredGame } from "@/types/game";
import { parseGame } from "@/types/game";

export default function TodayPage() {
  const [games, setGames] = useState<GameParsed[]>([]);
  const [results, setResults] = useState<ScoredGame[] | null>(null);
  const [loading, setLoading] = useState(true);

  const [params, setParams] = useState<TodayPlayParams>({
    playerCount: 3,
    availableTime: 90,
    desiredComplexity: 2.5,
    preferNewcomers: false,
  });

  useEffect(() => {
    fetch("/api/games")
      .then((res) => res.json())
      .then((data: Game[]) => setGames(data.map(parseGame)))
      .finally(() => setLoading(false));
  }, []);

  function handleSearch() {
    const scored = recommendGames(games, params);
    setResults(scored);
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-bold tracking-tight text-warm-900">Heute spielen</h1>
      <p className="mt-1 text-sm font-medium text-warm-500">
        Finde das passende Spiel für eure Runde
      </p>

      {/* Input form */}
      <div className="mt-6 rounded-2xl border border-warm-200/80 bg-white p-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-warm-500 uppercase tracking-wider">
              Spieler
            </label>
            <select
              value={params.playerCount}
              onChange={(e) => setParams({ ...params, playerCount: Number(e.target.value) })}
              className="w-full rounded-xl border border-warm-200 bg-warm-50/50 px-3 py-2.5 text-sm font-medium text-warm-800 transition-colors focus:border-forest focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest/10"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={n}>{n} Spieler</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-warm-500 uppercase tracking-wider">
              Zeit
            </label>
            <select
              value={params.availableTime}
              onChange={(e) => setParams({ ...params, availableTime: Number(e.target.value) })}
              className="w-full rounded-xl border border-warm-200 bg-warm-50/50 px-3 py-2.5 text-sm font-medium text-warm-800 transition-colors focus:border-forest focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest/10"
            >
              <option value={30}>30 Min</option>
              <option value={60}>1 Stunde</option>
              <option value={90}>1,5 Stunden</option>
              <option value={120}>2 Stunden</option>
              <option value={180}>3 Stunden</option>
              <option value={240}>4+ Stunden</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-warm-500 uppercase tracking-wider">
              Komplexität
            </label>
            <select
              value={params.desiredComplexity}
              onChange={(e) => setParams({ ...params, desiredComplexity: Number(e.target.value) })}
              className="w-full rounded-xl border border-warm-200 bg-warm-50/50 px-3 py-2.5 text-sm font-medium text-warm-800 transition-colors focus:border-forest focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest/10"
            >
              <option value={1}>Leicht (1.0)</option>
              <option value={1.5}>Leicht–Mittel (1.5)</option>
              <option value={2}>Mittel (2.0)</option>
              <option value={2.5}>Mittel–Gehoben (2.5)</option>
              <option value={3}>Gehoben (3.0)</option>
              <option value={3.5}>Gehoben–Schwer (3.5)</option>
              <option value={4}>Schwer (4.0)</option>
              <option value={4.5}>Sehr schwer (4.5)</option>
            </select>
          </div>

          <div className="flex items-end">
            <label className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-warm-200 bg-warm-50/50 px-3 py-2.5 text-sm font-medium text-warm-700 transition-colors hover:bg-warm-100">
              <input
                type="checkbox"
                checked={params.preferNewcomers}
                onChange={(e) => setParams({ ...params, preferNewcomers: e.target.checked })}
                className="h-4 w-4 rounded border-warm-300 text-forest focus:ring-forest/20"
              />
              Neulinge dabei
            </label>
          </div>
        </div>

        <button
          onClick={handleSearch}
          className="mt-5 w-full rounded-xl bg-forest px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-forest-dark hover:shadow-md active:scale-[0.98] sm:w-auto"
        >
          Passende Spiele finden
        </button>
      </div>

      {/* Results */}
      {results !== null && (
        <div className="mt-8">
          {results.length === 0 ? (
            <div className="rounded-2xl border border-warm-200/80 bg-white p-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-warm-100">
                <svg className="h-7 w-7 text-warm-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="mt-4 font-display text-lg font-semibold text-warm-700">Kein passendes Spiel gefunden</p>
              <p className="mt-1 text-sm text-warm-500">
                Probiere andere Parameter oder erweitere deine Sammlung.
              </p>
            </div>
          ) : (
            <>
              <h2 className="mb-4 font-display text-xl font-bold text-warm-900">
                {results.length} passende{results.length === 1 ? "s" : ""} Spiel{results.length === 1 ? "" : "e"}
              </h2>
              <div className="space-y-3">
                {results.map((game, i) => (
                  <div key={game.id} className="animate-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
                    <ScoredGameCard game={game} rank={i + 1} />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
