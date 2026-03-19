"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Game } from "@/types/game";
import { getAllGames, deleteGame } from "@/lib/db-client";

export default function ManageCollectionPage() {
  const router = useRouter();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "date">("name");

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

  useEffect(() => {
    loadGames();
  }, [loadGames]);

  const filteredGames = games
    .filter((g) => g.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === filteredGames.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredGames.map((g) => g.id)));
    }
  }

  async function handleDelete() {
    if (selected.size === 0) return;
    
    const confirmed = window.confirm(
      `Möchtest du ${selected.size} Spiel${selected.size !== 1 ? "e" : ""} wirklich löschen?`
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      for (const id of selected) {
        await deleteGame(id);
      }
      setSelected(new Set());
      await loadGames();
    } finally {
      setDeleting(false);
    }
  }

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
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-warm-900">Sammlung verwalten</h1>
          <p className="mt-1 text-sm font-medium text-warm-500">{games.length} Spiele</p>
        </div>
        <button
          onClick={() => router.push("/")}
          className="rounded-xl bg-warm-100 px-4 py-2 text-sm font-medium text-warm-600 transition-colors hover:bg-warm-200"
        >
          Zurück
        </button>
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <div className="relative flex-1 sm:flex-none">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-warm-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Suchen..."
              className="w-full rounded-xl border border-warm-200 bg-surface py-2 pl-9 pr-3 text-sm text-warm-800 placeholder:text-warm-400 focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/10 sm:w-64"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "name" | "date")}
            className="rounded-xl border border-warm-200 bg-surface px-3 py-2 text-sm text-warm-700 focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/10"
          >
            <option value="name">A–Z</option>
            <option value="date">Neueste</option>
          </select>
        </div>

        {selected.size > 0 && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-2 rounded-xl bg-coral px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-coral-dark disabled:opacity-50"
          >
            {deleting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Lösche...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                {selected.size} löschen
              </>
            )}
          </button>
        )}
      </div>

      {/* List */}
      <div className="rounded-2xl border border-warm-200/80 bg-surface overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-warm-100 bg-warm-50 px-4 py-3">
          <button
            onClick={toggleAll}
            className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2 transition-all ${
              selected.size === filteredGames.length && filteredGames.length > 0
                ? "border-forest bg-forest text-white"
                : "border-warm-300 bg-surface"
            }`}
          >
            {selected.size === filteredGames.length && filteredGames.length > 0 && (
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
          <span className="text-xs font-semibold uppercase tracking-wider text-warm-500">
            {selected.size > 0 ? `${selected.size} ausgewählt` : `${filteredGames.length} Spiele`}
          </span>
        </div>

        {/* Games list */}
        <div className="max-h-[60vh] overflow-y-auto">
          {filteredGames.length === 0 ? (
            <div className="p-8 text-center text-sm text-warm-500">
              {search ? "Keine Spiele gefunden" : "Noch keine Spiele in der Sammlung"}
            </div>
          ) : (
            filteredGames.map((game) => (
              <div
                key={game.id}
                className={`flex items-center gap-3 border-b border-warm-100 px-4 py-3 transition-colors last:border-b-0 ${
                  selected.has(game.id) ? "bg-coral-light/30" : "hover:bg-warm-50"
                }`}
              >
                <button
                  onClick={() => toggleSelect(game.id)}
                  className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2 transition-all ${
                    selected.has(game.id)
                      ? "border-coral bg-coral text-white"
                      : "border-warm-300 bg-surface"
                  }`}
                >
                  {selected.has(game.id) && (
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>

                {/* Thumbnail */}
                <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-warm-100">
                  {game.thumbnail ? (
                    <img src={game.thumbnail} alt={game.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <svg className="h-4 w-4 text-warm-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-warm-900 truncate">{game.name}</p>
                  <div className="flex items-center gap-2 text-xs text-warm-500">
                    <span>{game.minPlayers}–{game.maxPlayers} Spieler</span>
                    <span>•</span>
                    <span>{game.playingTime} Min</span>
                    {game.yearpublished && (
                      <>
                        <span>•</span>
                        <span>{game.yearpublished}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Quick delete */}
                <button
                  onClick={() => {
                    if (window.confirm(`"${game.name}" wirklich löschen?`)) {
                      deleteGame(game.id).then(() => loadGames());
                    }
                  }}
                  className="flex-shrink-0 rounded-lg p-2 text-warm-400 transition-colors hover:bg-coral-light hover:text-coral"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Tip */}
      <p className="mt-4 text-center text-xs text-warm-400">
        Tippe auf das Kästchen um mehrere Spiele auszuwählen, dann &quot;X löschen&quot;
      </p>
    </div>
  );
}
