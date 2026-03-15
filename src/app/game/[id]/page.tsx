"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import type { Game, GameParsed } from "@/types/game";
import { parseGame, PREDEFINED_TAGS } from "@/types/game";

export default function GameDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [game, setGame] = useState<GameParsed | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/games/${id}`)
      .then((res) => res.json())
      .then((data: Game) => setGame(parseGame(data)))
      .catch(() => setGame(null))
      .finally(() => setLoading(false));
  }, [id]);

  async function toggleFavorite() {
    if (!game) return;
    setSaving(true);
    const res = await fetch(`/api/games/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorite: !game.favorite }),
    });
    const updated: Game = await res.json();
    setGame(parseGame(updated));
    setSaving(false);
  }

  async function toggleTag(tag: string) {
    if (!game) return;
    const newTags = game.tags.includes(tag)
      ? game.tags.filter((t) => t !== tag)
      : [...game.tags, tag];

    setSaving(true);
    const res = await fetch(`/api/games/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: newTags }),
    });
    const updated: Game = await res.json();
    setGame(parseGame(updated));
    setSaving(false);
  }

  async function saveNotes(notes: string) {
    setSaving(true);
    const res = await fetch(`/api/games/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notes || null }),
    });
    const updated: Game = await res.json();
    setGame(parseGame(updated));
    setSaving(false);
  }

  async function saveShelfLocation(location: string) {
    setSaving(true);
    const res = await fetch(`/api/games/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shelfLocation: location || null }),
    });
    const updated: Game = await res.json();
    setGame(parseGame(updated));
    setSaving(false);
  }

  async function markAsPlayed() {
    setSaving(true);
    const res = await fetch(`/api/games/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lastPlayed: new Date().toISOString().split("T")[0] }),
    });
    const updated: Game = await res.json();
    setGame(parseGame(updated));
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  if (!game) {
    return (
      <div className="text-center mt-16">
        <p className="font-display text-lg font-semibold text-warm-700">Spiel nicht gefunden.</p>
        <Link href="/" className="mt-3 inline-block text-sm font-medium text-forest hover:text-forest-dark">
          Zurück zur Sammlung
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Back link */}
      <Link href="/" className="group inline-flex items-center gap-1.5 text-sm font-medium text-warm-500 transition-colors hover:text-warm-800">
        <svg className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Sammlung
      </Link>

      <div className="mt-5 grid gap-8 sm:grid-cols-[300px_1fr]">
        {/* Image */}
        <div className="overflow-hidden rounded-2xl bg-warm-100 shadow-sm">
          {game.image || game.thumbnail ? (
            <img
              src={game.image || game.thumbnail || ""}
              alt={game.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex aspect-square items-center justify-center text-warm-300">
              <svg className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-warm-900">{game.name}</h1>
              {game.yearpublished && (
                <p className="mt-0.5 text-sm font-medium text-warm-500">{game.yearpublished}</p>
              )}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={toggleFavorite}
                disabled={saving}
                className={`rounded-xl px-3.5 py-2 text-sm font-medium transition-all ${
                  game.favorite
                    ? "bg-amber-light text-amber-dark shadow-sm hover:shadow-md"
                    : "bg-warm-100 text-warm-600 hover:bg-warm-200"
                }`}
              >
                {game.favorite ? "★ Favorit" : "☆ Favorit"}
              </button>
              <Link
                href={`/game/${id}/edit`}
                className="rounded-xl bg-warm-100 px-3.5 py-2 text-sm font-medium text-warm-600 transition-colors hover:bg-warm-200"
              >
                Bearbeiten
              </Link>
            </div>
          </div>

          {/* Stats grid */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatBox label="Spieler" value={`${game.minPlayers}–${game.maxPlayers}`} />
            <StatBox label="Dauer" value={`${game.playingTime} Min`} />
            <StatBox label="Komplexität" value={game.averageWeight.toFixed(1) + " / 5"} />
            <StatBox label="Alter" value={game.minAge > 0 ? `${game.minAge}+` : "–"} />
          </div>

          {/* Quick actions */}
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              onClick={markAsPlayed}
              disabled={saving}
              className="rounded-xl bg-forest px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-forest-dark hover:shadow-md active:scale-[0.98]"
            >
              Heute gespielt
            </button>
            {game.lastPlayed && (
              <span className="inline-flex items-center rounded-xl bg-warm-50 px-3.5 py-2 text-sm text-warm-500 ring-1 ring-warm-200/60">
                Zuletzt: {new Date(game.lastPlayed).toLocaleDateString("de-DE")}
              </span>
            )}
          </div>

          {/* Tags */}
          <div className="mt-8">
            <h3 className="text-xs font-semibold text-warm-500 uppercase tracking-wider">Tags</h3>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {PREDEFINED_TAGS.map((tag) => (
                <button
                  key={tag.value}
                  onClick={() => toggleTag(tag.value)}
                  disabled={saving}
                  className={`rounded-xl px-3.5 py-1.5 text-xs font-medium transition-all ${
                    game.tags.includes(tag.value)
                      ? "bg-forest text-white shadow-sm"
                      : "bg-warm-50 text-warm-600 ring-1 ring-warm-200/60 hover:bg-warm-100"
                  }`}
                >
                  {tag.label}
                </button>
              ))}
            </div>
          </div>

          {/* Shelf location */}
          <div className="mt-6">
            <label className="text-xs font-semibold text-warm-500 uppercase tracking-wider">Standort im Schrank</label>
            <input
              type="text"
              defaultValue={game.shelfLocation || ""}
              onBlur={(e) => {
                if (e.target.value !== (game.shelfLocation || "")) {
                  saveShelfLocation(e.target.value);
                }
              }}
              placeholder="z.B. Regal 1, oben"
              className="mt-2 w-full rounded-xl border border-warm-200 bg-warm-50/50 px-3.5 py-2.5 text-sm text-warm-800 placeholder:text-warm-400 transition-colors focus:border-forest focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest/10"
            />
          </div>

          {/* Notes */}
          <div className="mt-4">
            <label className="text-xs font-semibold text-warm-500 uppercase tracking-wider">Notizen</label>
            <textarea
              defaultValue={game.notes || ""}
              onBlur={(e) => {
                if (e.target.value !== (game.notes || "")) {
                  saveNotes(e.target.value);
                }
              }}
              rows={3}
              placeholder="Eigene Notizen zum Spiel..."
              className="mt-2 w-full rounded-xl border border-warm-200 bg-warm-50/50 px-3.5 py-2.5 text-sm text-warm-800 placeholder:text-warm-400 transition-colors focus:border-forest focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest/10"
            />
          </div>

          {/* Categories & Mechanics */}
          {game.categories.length > 0 && (
            <div className="mt-8">
              <h3 className="text-xs font-semibold text-warm-500 uppercase tracking-wider">Kategorien</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {game.categories.map((cat) => (
                  <span key={cat} className="rounded-lg bg-warm-50 px-2.5 py-1 text-xs font-medium text-warm-600 ring-1 ring-warm-200/60">
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          )}

          {game.mechanics.length > 0 && (
            <div className="mt-5">
              <h3 className="text-xs font-semibold text-warm-500 uppercase tracking-wider">Mechaniken</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {game.mechanics.map((mech) => (
                  <span key={mech} className="rounded-lg bg-warm-50 px-2.5 py-1 text-xs font-medium text-warm-600 ring-1 ring-warm-200/60">
                    {mech}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* BGG Link */}
          {game.bggId && (
            <div className="mt-8 border-t border-warm-100 pt-5">
              <a
                href={`https://boardgamegeek.com/boardgame/${game.bggId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-forest transition-colors hover:text-forest-dark"
              >
                Auf BoardGameGeek ansehen
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          )}
        </div>
      </div>

      {saving && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 rounded-xl bg-warm-900 px-5 py-2.5 text-sm font-medium text-white shadow-xl sm:bottom-6">
          Wird gespeichert...
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-warm-50 p-3.5 text-center ring-1 ring-warm-200/40">
      <p className="text-[11px] font-semibold text-warm-500 uppercase tracking-wider">{label}</p>
      <p className="mt-1 font-display text-base font-bold text-warm-900">{value}</p>
    </div>
  );
}
