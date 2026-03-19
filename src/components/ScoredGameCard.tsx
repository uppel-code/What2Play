"use client";

import { useState } from "react";
import Link from "next/link";
import type { ScoredGame } from "@/types/game";

interface ScoredGameCardProps {
  game: ScoredGame;
  rank: number;
}

export default function ScoredGameCard({ game, rank }: ScoredGameCardProps) {
  const { scoreBreakdown } = game;
  const pct = Math.round(game.score);
  const reasons = getReasons(game);

  return (
    <Link
      href={`/game?id=${game.id}`}
      className="card-hover group relative flex gap-4 rounded-2xl border border-warm-200/80 bg-surface p-4 overflow-hidden"
    >
      {/* Score percentage bar (background) */}
      <div
        className="absolute inset-y-0 left-0 bg-forest/[0.04] transition-all duration-500"
        style={{ width: `${pct}%` }}
      />

      {/* Rank badge + score */}
      <div className="relative z-10 flex flex-col items-center justify-start gap-1">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold ${
          rank <= 3 ? "bg-amber text-white shadow-sm" : "bg-warm-100 text-warm-500"
        }`}>
          {rank}
        </span>
        <span className="text-lg font-bold font-display text-forest">{pct}</span>
        <span className="text-[10px] font-medium text-warm-400">%</span>
      </div>

      {/* Thumbnail */}
      <div className="relative z-10 h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-warm-100">
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
      <div className="relative z-10 flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display font-semibold text-warm-900 truncate">{game.name}</h3>
          {/* BGG Rating */}
          {game.bggRating != null && game.bggRating > 0 && (
            <span className="flex-shrink-0 inline-flex items-center gap-1 rounded-lg bg-amber-light px-2 py-0.5 text-[11px] font-bold text-amber-dark" title="BoardGameGeek Bewertung">
              <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              {game.bggRating.toFixed(1)}
            </span>
          )}
        </div>

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

        {/* Score breakdown pills */}
        <div className="mt-2 flex flex-wrap items-center gap-1 text-[10px] font-medium">
          <ScorePill label="Spieler" value={scoreBreakdown.playerFit} max={35} />
          <ScorePill label="Zeit" value={scoreBreakdown.timeFit} max={25} />
          <ScorePill label="Komplex." value={scoreBreakdown.complexityFit} max={18} />
          {scoreBreakdown.favoriteBonus > 0 && <ScorePill label="Favorit" value={scoreBreakdown.favoriteBonus} max={5} />}
          {scoreBreakdown.lastPlayedBonus > 0 && <ScorePill label="Nicht gespielt" value={scoreBreakdown.lastPlayedBonus} max={12} />}
          {scoreBreakdown.tagBonus > 0 && <ScorePill label="Tag" value={scoreBreakdown.tagBonus} max={5} />}

          {/* Warum tooltip */}
          {reasons.length > 0 && <WhyTooltip reasons={reasons} />}
        </div>
      </div>
    </Link>
  );
}

function ScorePill({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = (value / max) * 100;
  let color = "bg-coral-light text-coral";
  if (pct >= 80) color = "bg-easy text-easy-text";
  else if (pct >= 50) color = "bg-amber-light text-amber-dark";
  else if (pct >= 30) color = "bg-hard text-hard-text";

  return (
    <span className={`rounded-md px-1.5 py-0.5 ${color}`}>
      {label}: {value}/{max}
    </span>
  );
}

function getReasons(game: ScoredGame): string[] {
  const reasons: string[] = [];
  const b = game.scoreBreakdown;
  if (b.playerFit >= 28) reasons.push("Passt zur Spieleranzahl");
  if (b.timeFit >= 20) reasons.push("Passt zur Zeit");
  if (b.complexityFit >= 14) reasons.push("Nicht zu komplex");
  if (b.lastPlayedBonus >= 9) reasons.push("Lange nicht gespielt");
  if (b.favoriteBonus > 0) reasons.push("Euer Favorit");
  if (b.tagBonus > 0) reasons.push("Passende Tags");
  return reasons;
}

function WhyTooltip({ reasons }: { reasons: string[] }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(!open);
        }}
        className="rounded-md bg-forest-light px-1.5 py-0.5 text-forest hover:bg-forest hover:text-white transition-colors cursor-pointer"
      >
        Warum?
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
            }}
          />
          <div className="absolute bottom-full left-0 z-50 mb-2 w-52 rounded-xl border border-warm-200/80 bg-surface p-3 shadow-xl animate-fade-up" style={{ animationDuration: "0.2s" }}>
            <p className="mb-1.5 text-[11px] font-semibold text-warm-700">Warum dieses Spiel?</p>
            <ul className="space-y-1">
              {reasons.map((r) => (
                <li key={r} className="flex items-center gap-1.5 text-[11px] text-warm-600">
                  <span className="h-1 w-1 flex-shrink-0 rounded-full bg-forest" />
                  {r}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </span>
  );
}
