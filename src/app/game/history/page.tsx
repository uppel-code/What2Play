"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Game, PlaySession, Player } from "@/types/game";
import { getGameById, getSessionsByGame, getAllPlayers, deletePlaySession } from "@/lib/db-client";

function HistoryContent() {
  const searchParams = useSearchParams();
  const id = Number(searchParams.get("id"));
  const [game, setGame] = useState<Game | null>(null);
  const [sessions, setSessions] = useState<PlaySession[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    Promise.all([
      getGameById(id),
      getSessionsByGame(id),
      getAllPlayers(),
    ])
      .then(([g, s, p]) => {
        setGame(g ?? null);
        setSessions(s);
        setPlayers(p);
      })
      .catch(() => setGame(null))
      .finally(() => setLoading(false));
  }, [id]);

  function playerName(playerId: number | null) {
    if (!playerId) return null;
    return players.find((p) => p.id === playerId)?.name ?? "Unbekannt";
  }

  async function handleDelete(sessionId: number) {
    if (!window.confirm("Partie wirklich löschen?")) return;
    await deletePlaySession(sessionId);
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
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
      <Link
        href={`/game?id=${game.id}`}
        className="group inline-flex items-center gap-1.5 text-sm font-medium text-warm-500 transition-colors hover:text-warm-800"
      >
        <svg className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        {game.name}
      </Link>

      <h1 className="mt-4 font-display text-2xl font-bold tracking-tight text-warm-900">
        Spielverlauf
      </h1>
      <p className="mt-1 text-sm text-warm-500">
        {sessions.length} {sessions.length === 1 ? "Partie" : "Partien"} gespielt
      </p>

      {sessions.length === 0 ? (
        <div className="mt-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-warm-100">
            <svg className="h-8 w-8 text-warm-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="mt-4 font-display text-lg font-semibold text-warm-700">Noch keine Partien</p>
          <p className="mt-1 text-sm text-warm-500">Trag deine erste Partie auf der Spielseite ein.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="rounded-2xl border border-warm-200/80 bg-surface p-4 transition-colors hover:border-warm-300/80"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-sm font-bold text-warm-900">
                    {new Date(session.playedAt).toLocaleDateString("de-DE", {
                      weekday: "short",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-warm-600">
                    <span className="inline-flex items-center gap-1">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {session.playerCount} Spieler
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {session.duration} Min
                    </span>
                    {session.winnerId && (
                      <span className="inline-flex items-center gap-1 font-medium text-forest">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                        </svg>
                        {playerName(session.winnerId)}
                      </span>
                    )}
                  </div>
                  {session.notes && (
                    <p className="mt-2 text-xs text-warm-500 italic">{session.notes}</p>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(session.id)}
                  className="shrink-0 rounded-lg p-1.5 text-warm-400 transition-colors hover:bg-warm-100 hover:text-warm-600"
                  title="Löschen"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function GameHistoryPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center"><div className="spinner" /></div>}>
      <HistoryContent />
    </Suspense>
  );
}
