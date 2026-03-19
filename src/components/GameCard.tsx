"use client";

import Link from "next/link";
import type { Game } from "@/types/game";

interface GameCardProps {
  game: Game;
}

function complexityLabel(weight: number): string {
  if (weight <= 1.5) return "Leicht";
  if (weight <= 2.5) return "Mittel";
  if (weight <= 3.5) return "Gehoben";
  return "Schwer";
}

function complexityColor(weight: number): string {
  if (weight <= 1.5) return "bg-easy text-easy-text";
  if (weight <= 2.5) return "bg-amber-light text-amber-dark";
  if (weight <= 3.5) return "bg-hard text-hard-text";
  return "bg-coral-light text-coral";
}

export default function GameCard({ game }: GameCardProps) {
  return (
    <Link
      href={`/game?id=${game.id}`}
      className="card-hover group block overflow-hidden rounded-2xl border border-warm-200/80 bg-surface"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-warm-100">
        {game.thumbnail ? (
          <img
            src={game.thumbnail}
            alt={game.name}
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-warm-300">
            <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
        )}
        {game.favorite && (
          <span className="absolute top-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-amber/90 text-xs text-white shadow-sm backdrop-blur-sm">
            ★
          </span>
        )}
        {!game.lastPlayed && (
          <span className="absolute top-2.5 left-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-warm-600/70 text-[10px] text-white shadow-sm backdrop-blur-sm" title="Nie gespielt">
            🕸️
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/20 to-transparent" />
      </div>
      <div className="p-3.5">
        <h3 className="font-display font-semibold text-warm-900 truncate leading-snug">{game.name}</h3>
        {game.yearpublished && (
          <p className="mt-0.5 text-xs text-warm-500">{game.yearpublished}</p>
        )}
        <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11px] font-medium">
          <span className="inline-flex items-center gap-1 rounded-lg bg-forest-light px-2 py-0.5 text-forest">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {game.minPlayers === game.maxPlayers
              ? game.minPlayers
              : `${game.minPlayers}–${game.maxPlayers}`}
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg bg-warm-100 px-2 py-0.5 text-warm-600">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {game.playingTime}′
          </span>
          <span className={`inline-flex items-center rounded-lg px-2 py-0.5 ${complexityColor(game.averageWeight)}`}>
            {complexityLabel(game.averageWeight)}
          </span>
          {game.bggRating != null && game.bggRating > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded-lg bg-amber-light px-2 py-0.5 text-amber-dark">
              <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              {game.bggRating.toFixed(1)}
            </span>
          )}
        </div>
        {game.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {game.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="rounded-full bg-warm-50 px-2 py-0.5 text-[10px] font-medium text-warm-500 ring-1 ring-warm-200/60">
                {tagLabel(tag)}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

function tagLabel(tag: string): string {
  const labels: Record<string, string> = {
    "good-with-newcomers": "Neuling-freundlich",
    "good-for-two": "Gut zu zweit",
    "quick-to-explain": "Schnell erklärt",
    "favorite": "Lieblingsspiel",
    "party-game": "Partyspiel",
    "expert-game": "Kennerspiel",
  };
  return labels[tag] || tag;
}
