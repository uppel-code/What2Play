"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Game } from "@/types/game";
import { PREDEFINED_TAGS, COMMON_MECHANICS } from "@/types/game";
import { getGameById, updateGame, createPlaySession, getSessionsByGame, getAllPlayers } from "@/lib/db-client";
import { generateQuickRules, isAiConfigured } from "@/services/ai-client";
import { COMMON_MECHANICS as AI_MECHANICS } from "@/types/game";
import RegelGuru from "@/components/RegelGuru";
import type { Player, PlaySession } from "@/types/game";

function GameDetailContent() {
  const searchParams = useSearchParams();
  const id = Number(searchParams.get("id"));
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showQuickRules, setShowQuickRules] = useState(false);
  const [quickRulesText, setQuickRulesText] = useState<string | null>(null);
  const [quickRulesLoading, setQuickRulesLoading] = useState(false);
  const [quickRulesError, setQuickRulesError] = useState<string | null>(null);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [sessions, setSessions] = useState<PlaySession[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    Promise.all([
      getGameById(id),
      getSessionsByGame(id),
      getAllPlayers(),
      isAiConfigured(),
    ])
      .then(([data, sess, pl, aiOk]) => {
        setGame(data ?? null);
        setSessions(sess);
        setPlayers(pl);
        setAiAvailable(aiOk);
      })
      .catch(() => setGame(null))
      .finally(() => setLoading(false));
  }, [id]);

  async function toggleFavorite() {
    if (!game) return;
    setSaving(true);
    const updated = await updateGame(game.id, { favorite: !game.favorite });
    if (updated) setGame(updated);
    setSaving(false);
  }

  async function toggleTag(tag: string) {
    if (!game) return;
    const newTags = game.tags.includes(tag)
      ? game.tags.filter((t) => t !== tag)
      : [...game.tags, tag];
    setSaving(true);
    const updated = await updateGame(game.id, { tags: newTags });
    if (updated) setGame(updated);
    setSaving(false);
  }

  async function saveNotes(notes: string) {
    if (!game) return;
    setSaving(true);
    const updated = await updateGame(game.id, { notes: notes || null });
    if (updated) setGame(updated);
    setSaving(false);
  }

  async function saveShelfLocation(location: string) {
    if (!game) return;
    setSaving(true);
    const updated = await updateGame(game.id, { shelfLocation: location || null });
    if (updated) setGame(updated);
    setSaving(false);
  }

  async function markAsPlayed() {
    if (!game) return;
    setSaving(true);
    const updated = await updateGame(game.id, { lastPlayed: new Date().toISOString().split("T")[0] });
    if (updated) setGame(updated);
    setSaving(false);
  }

  async function openQuickRules() {
    if (!game) return;
    setShowQuickRules(true);
    setQuickRulesError(null);
    if (quickRulesText) return; // already loaded
    setQuickRulesLoading(true);
    try {
      const mechanicLabels = game.mechanics.map((m) => {
        const known = AI_MECHANICS.find((k) => k.value === m);
        return known ? known.label : m;
      });
      const text = await generateQuickRules(game.name, mechanicLabels);
      setQuickRulesText(text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
      if (msg === "AI_NOT_CONFIGURED") {
        setQuickRulesError("AI ist nicht konfiguriert. Bitte richte in den Einstellungen einen AI-Provider ein.");
      } else if (msg === "AI_RATE_LIMIT") {
        setQuickRulesError("Zu viele Anfragen. Bitte versuche es in einer Minute erneut.");
      } else {
        setQuickRulesError("Regeln konnten nicht geladen werden. Bitte versuche es erneut.");
      }
    } finally {
      setQuickRulesLoading(false);
    }
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
                href={`/game/edit?id=${game.id}`}
                className="rounded-xl bg-warm-100 px-3.5 py-2 text-sm font-medium text-warm-600 transition-colors hover:bg-warm-200"
              >
                Bearbeiten
              </Link>
            </div>
          </div>

          {/* BGG Rating */}
          {game.bggRating != null && game.bggRating > 0 && (
            <div className="mt-4 flex items-center gap-3">
              <div className="flex items-center gap-1.5 rounded-xl bg-amber-light px-4 py-2">
                <svg className="h-5 w-5 text-amber-dark" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="font-display text-lg font-bold text-amber-dark">{game.bggRating.toFixed(1)}</span>
                <span className="text-sm text-amber-dark/70">/ 10</span>
              </div>
              {game.bggRank != null && (
                <span className="rounded-xl bg-warm-50 px-3.5 py-2 text-sm font-medium text-warm-600 ring-1 ring-warm-200/60">
                  BGG Rang #{game.bggRank}
                </span>
              )}
            </div>
          )}

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
              onClick={() => setShowSessionModal(true)}
              className="rounded-xl bg-forest px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-forest-dark hover:shadow-md active:scale-[0.98]"
            >
              Gespielt!
            </button>
            {aiAvailable && (
              <button
                onClick={openQuickRules}
                className="rounded-xl bg-amber-light px-4 py-2 text-sm font-semibold text-amber-dark shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
              >
                🎲 Wie ging das nochmal?
              </button>
            )}
            <Link
              href={`/game/history?id=${game.id}`}
              className="rounded-xl bg-warm-100 px-4 py-2 text-sm font-medium text-warm-600 transition-colors hover:bg-warm-200"
            >
              {sessions.length} {sessions.length === 1 ? "Partie" : "Partien"}
            </Link>
            {game.lastPlayed && (
              <span className="inline-flex items-center rounded-xl bg-warm-50 px-3.5 py-2 text-sm text-warm-500 ring-1 ring-warm-200/60">
                Zuletzt: {new Date(game.lastPlayed).toLocaleDateString("de-DE")}
              </span>
            )}
          </div>

          {/* RegelGuru Chat */}
          {aiAvailable && <RegelGuru game={game} />}

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
              className="mt-2 w-full rounded-xl border border-warm-200 bg-warm-50/50 px-3.5 py-2.5 text-sm text-warm-800 placeholder:text-warm-400 transition-colors focus:border-forest focus:bg-surface focus:outline-none focus:ring-2 focus:ring-forest/10"
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
              className="mt-2 w-full rounded-xl border border-warm-200 bg-warm-50/50 px-3.5 py-2.5 text-sm text-warm-800 placeholder:text-warm-400 transition-colors focus:border-forest focus:bg-surface focus:outline-none focus:ring-2 focus:ring-forest/10"
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
                {game.mechanics.map((mech) => {
                  const known = COMMON_MECHANICS.find((m) => m.value === mech);
                  return (
                    <span key={mech} className="rounded-lg bg-forest-light px-2.5 py-1 text-xs font-medium text-forest ring-1 ring-forest/20">
                      {known ? known.label : mech}
                    </span>
                  );
                })}
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

      {/* Session Modal */}
      {showSessionModal && (
        <PlaySessionModal
          game={game}
          players={players}
          onClose={() => setShowSessionModal(false)}
          onSaved={async (session) => {
            setSessions((prev) => [session, ...prev]);
            const updated = await getGameById(game.id);
            if (updated) setGame(updated);
            setShowSessionModal(false);
          }}
        />
      )}

      {/* Quick Rules Modal */}
      {showQuickRules && game && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-warm-900/60 backdrop-blur-sm" onClick={() => setShowQuickRules(false)}>
          <div className="mx-4 w-full max-w-md rounded-2xl bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🎲</span>
              <h2 className="font-display text-xl font-bold text-warm-900">Kurzregeln</h2>
            </div>
            <p className="mt-1 text-sm text-warm-500">{game.name}</p>

            <div className="mt-5">
              {quickRulesLoading && (
                <div className="flex flex-col items-center gap-3 py-8">
                  <div className="spinner" />
                  <p className="text-sm text-warm-500">Regeln werden zusammengefasst...</p>
                </div>
              )}
              {quickRulesError && (
                <div className="rounded-xl bg-coral-light p-4 text-sm text-coral">
                  {quickRulesError}
                </div>
              )}
              {quickRulesText && (
                <p className="text-sm leading-relaxed text-warm-800 whitespace-pre-line">
                  {quickRulesText}
                </p>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowQuickRules(false)}
                className="flex-1 rounded-xl bg-warm-100 px-4 py-2.5 text-sm font-medium text-warm-600 transition-colors hover:bg-warm-200"
              >
                Schließen
              </button>
              <a
                href={`https://www.youtube.com/results?search_query=${encodeURIComponent(game.name + " Regeln erklärt")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-forest-dark hover:shadow-md active:scale-[0.98]"
              >
                ▶ Video anschauen
              </a>
            </div>
          </div>
        </div>
      )}

      {saving && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 rounded-xl bg-invert px-5 py-2.5 text-sm font-medium text-invert-text shadow-xl sm:bottom-6">
          Wird gespeichert...
        </div>
      )}
    </div>
  );
}

export default function GameDetailPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center"><div className="spinner" /></div>}>
      <GameDetailContent />
    </Suspense>
  );
}

function PlaySessionModal({
  game,
  players,
  onClose,
  onSaved,
}: {
  game: Game;
  players: Player[];
  onClose: () => void;
  onSaved: (session: PlaySession) => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [playedAt, setPlayedAt] = useState(today);
  const [playerCount, setPlayerCount] = useState(game.minPlayers);
  const [duration, setDuration] = useState(game.playingTime);
  const [winnerId, setWinnerId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const session = await createPlaySession({
      gameId: game.id,
      playedAt,
      playerCount,
      duration,
      winnerId: winnerId || null,
      notes: notes || null,
    });
    onSaved(session);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-warm-900/60 backdrop-blur-sm" onClick={onClose}>
      <div className="mx-4 w-full max-w-md rounded-2xl bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-xl font-bold text-warm-900">Partie eintragen</h2>
        <p className="mt-1 text-sm text-warm-500">{game.name}</p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-warm-500 uppercase tracking-wider">Datum</label>
            <input
              type="date"
              value={playedAt}
              onChange={(e) => setPlayedAt(e.target.value)}
              max={today}
              required
              className="mt-1.5 w-full rounded-xl border border-warm-200 bg-warm-50/50 px-3.5 py-2.5 text-sm text-warm-800 focus:border-forest focus:bg-surface focus:outline-none focus:ring-2 focus:ring-forest/10"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-warm-500 uppercase tracking-wider">Spieler</label>
              <input
                type="number"
                value={playerCount}
                onChange={(e) => setPlayerCount(Number(e.target.value))}
                min={1}
                max={20}
                required
                className="mt-1.5 w-full rounded-xl border border-warm-200 bg-warm-50/50 px-3.5 py-2.5 text-sm text-warm-800 focus:border-forest focus:bg-surface focus:outline-none focus:ring-2 focus:ring-forest/10"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-warm-500 uppercase tracking-wider">Dauer (Min)</label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                min={1}
                required
                className="mt-1.5 w-full rounded-xl border border-warm-200 bg-warm-50/50 px-3.5 py-2.5 text-sm text-warm-800 focus:border-forest focus:bg-surface focus:outline-none focus:ring-2 focus:ring-forest/10"
              />
            </div>
          </div>

          {players.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-warm-500 uppercase tracking-wider">Gewinner (optional)</label>
              <select
                value={winnerId ?? ""}
                onChange={(e) => setWinnerId(e.target.value ? Number(e.target.value) : null)}
                className="mt-1.5 w-full rounded-xl border border-warm-200 bg-warm-50/50 px-3.5 py-2.5 text-sm text-warm-800 focus:border-forest focus:bg-surface focus:outline-none focus:ring-2 focus:ring-forest/10"
              >
                <option value="">– Kein Gewinner –</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-warm-500 uppercase tracking-wider">Notizen (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Wie war die Partie?"
              className="mt-1.5 w-full rounded-xl border border-warm-200 bg-warm-50/50 px-3.5 py-2.5 text-sm text-warm-800 placeholder:text-warm-400 focus:border-forest focus:bg-surface focus:outline-none focus:ring-2 focus:ring-forest/10"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl bg-warm-100 px-4 py-2.5 text-sm font-medium text-warm-600 transition-colors hover:bg-warm-200"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-forest-dark hover:shadow-md active:scale-[0.98] disabled:opacity-50"
            >
              {submitting ? "Speichern..." : "Speichern"}
            </button>
          </div>
        </form>
      </div>
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
