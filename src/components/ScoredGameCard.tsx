"use client";

import Link from "next/link";
import type { ScoredGame } from "@/types/game";

interface ScoredGameCardProps {
  game: ScoredGame;
  rank: number;
}

export default function ScoredGameCard({ game, rank }: ScoredGameCardProps) {
  const { scoreBreakdown } = game;

  return (
    <Link
      href={`/game?id=${game.id}`}
      className="card-hover group flex gap-4 rounded-2xl border border-warm-200/80 bg-white p-4"
    >
      {/* Rank badge */}
      <div className="flex flex-col items-center justify-start gap-1">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold ${
          rank <= 3 ? "bg-amber text-white shadow-sm" : "bg-warm-100 text-warm-500"
        }`}>
          {rank}
        </span>
        <span className="text-lg font-bold font-display text-forest">{game.score}</span>
        <span className="text-[10px] font-medium text-warm-400">Punkte</span>
      </div>

      {/* Thumbnail */}
      <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-warm-100">
        {game.thumbnail ? (
          <img src={game.thumbnail} alt={game.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center text-warm-300">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <h3 className="font-display font-semibold text-warm-900 truncate">{game.name}</h3>
        <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] font-medium">
          <span className="inline-flex items-center gap-1 rounded-lg bg-forest-light px-2 py-0.5 text-forest">
            {game.minPlayers}–{game.maxPlayers} Spieler
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg bg-warm-100 px-2 py-0.5 text-warm-600">
            {game.playingTime}′
          </span>
          <span className="inline-flex items-center rounded-lg bg-warm-100 px-2 py-0.5 text-warm-600">
            Komplex. {game.averageWeight.toFixed(1)}
          </span>
          {game.favorite && (
            <span className="rounded-lg bg-amber-light px-2 py-0.5 text-amber-dark">★ Favorit</span>
          )}
        </div>

        {/* Score breakdown */}
        <div className="mt-2 flex flex-wrap gap-1 text-[10px] font-medium">
          <ScorePill label="Spieler" value={scoreBreakdown.playerFit} max={35} />
          <ScorePill label="Zeit" value={scoreBreakdown.timeFit} max={30} />
          <ScorePill label="Komplex." value={scoreBreakdown.complexityFit} max={20} />
          {scoreBreakdown.favoriteBonus > 0 && <ScorePill label="Favorit" value={scoreBreakdown.favoriteBonus} max={5} />}
          {scoreBreakdown.lastPlayedBonus > 0 && <ScorePill label="Nicht gespielt" value={scoreBreakdown.lastPlayedBonus} max={5} />}
          {scoreBreakdown.tagBonus > 0 && <ScorePill label="Tag" value={scoreBreakdown.tagBonus} max={5} />}
        </div>
      </div>
    </Link>
  );
}

function ScorePill({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = (value / max) * 100;
  let color = "bg-coral-light text-coral";
  if (pct >= 80) color = "bg-emerald-50 text-emerald-700";
  else if (pct >= 50) color = "bg-amber-light text-amber-dark";
  else if (pct >= 30) color = "bg-orange-50 text-orange-700";

  return (
    <span className={`rounded-md px-1.5 py-0.5 ${color}`}>
      {label}: {value}/{max}
    </span>
  );
}
