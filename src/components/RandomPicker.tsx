"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Game } from "@/types/game";
import { useRouter } from "next/navigation";

interface RandomPickerProps {
  games: Game[];
}

export default function RandomPicker({ games }: RandomPickerProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [currentGame, setCurrentGame] = useState<Game | null>(null);
  const [done, setDone] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    intervalRef.current = null;
    timeoutRef.current = null;
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const spin = useCallback(() => {
    if (games.length === 0) return;
    setOpen(true);
    setSpinning(true);
    setDone(false);

    cleanup();

    // Pick the winner upfront
    const winner = games[Math.floor(Math.random() * games.length)];

    // Cycle through random games quickly, then slow down
    let speed = 60;
    let elapsed = 0;
    const totalDuration = 2400;

    const tick = () => {
      const randomGame = games[Math.floor(Math.random() * games.length)];
      setCurrentGame(randomGame);
      elapsed += speed;

      if (elapsed >= totalDuration) {
        // Land on the winner
        cleanup();
        setCurrentGame(winner);
        setSpinning(false);
        setDone(true);
        return;
      }

      // Gradually slow down
      if (elapsed > totalDuration * 0.6) {
        speed = Math.min(speed + 30, 400);
      } else if (elapsed > totalDuration * 0.3) {
        speed = Math.min(speed + 10, 200);
      }

      intervalRef.current = setTimeout(tick, speed);
    };

    intervalRef.current = setTimeout(tick, speed);
  }, [games, cleanup]);

  const close = useCallback(() => {
    cleanup();
    setOpen(false);
    setSpinning(false);
    setDone(false);
    setCurrentGame(null);
  }, [cleanup]);

  const complexityLabel = (w: number) => {
    if (w <= 1.5) return "Leicht";
    if (w <= 2.5) return "Einfach";
    if (w <= 3.5) return "Mittel";
    if (w <= 4.5) return "Schwer";
    return "Komplex";
  };

  if (games.length === 0) return null;

  return (
    <>
      <button
        onClick={spin}
        className="group flex items-center gap-2 rounded-xl bg-amber px-4 py-2 text-sm font-bold text-white shadow-md transition-all hover:bg-amber-dark hover:shadow-lg active:scale-95"
      >
        <svg className="h-5 w-5 transition-transform group-hover:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Überrasch mich!
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget && done) close(); }}
        >
          {/* Backdrop */}
          <div className="animate-picker-fade-in absolute inset-0 bg-warm-900/60 backdrop-blur-sm dark:bg-black/70" />

          {/* Modal */}
          <div className="animate-picker-pop relative w-full max-w-sm overflow-hidden rounded-2xl bg-surface dark:bg-warm-800 shadow-2xl">
            {/* Close button */}
            {done && (
              <button
                onClick={close}
                className="absolute right-3 top-3 z-10 rounded-full bg-warm-100/80 p-1.5 text-warm-500 backdrop-blur-sm transition-colors hover:bg-warm-200 hover:text-warm-700"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}

            {/* Game image */}
            <div className="relative h-56 overflow-hidden bg-warm-100">
              {currentGame?.image || currentGame?.thumbnail ? (
                <img
                  src={currentGame.image || currentGame.thumbnail || ""}
                  alt={currentGame.name}
                  className={`h-full w-full object-cover transition-all duration-150 ${spinning ? "scale-105 blur-[1px]" : ""}`}
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <svg className="h-16 w-16 text-warm-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
              )}

              {/* Spinning overlay */}
              {spinning && (
                <div className="absolute inset-0 flex items-center justify-center bg-warm-900/30">
                  <div className="animate-picker-dice text-5xl">🎲</div>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="p-5">
              {currentGame ? (
                <>
                  <h3
                    className={`font-display text-xl font-bold text-warm-900 transition-all duration-150 ${
                      spinning ? "opacity-60" : ""
                    } ${done ? "animate-picker-bounce" : ""}`}
                  >
                    {currentGame.name}
                  </h3>

                  {/* Metadata chips */}
                  <div className={`mt-3 flex flex-wrap gap-2 transition-opacity duration-150 ${spinning ? "opacity-40" : ""}`}>
                    <span className="inline-flex items-center gap-1 rounded-lg bg-warm-100 px-2.5 py-1 text-xs font-medium text-warm-600">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {currentGame.minPlayers === currentGame.maxPlayers
                        ? `${currentGame.minPlayers}`
                        : `${currentGame.minPlayers}–${currentGame.maxPlayers}`} Spieler
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-lg bg-warm-100 px-2.5 py-1 text-xs font-medium text-warm-600">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {currentGame.playingTime} Min
                    </span>
                    {currentGame.averageWeight > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-warm-100 px-2.5 py-1 text-xs font-medium text-warm-600">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l3 9a5.002 5.002 0 006.001 0M18 7l-3 9m0-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                        </svg>
                        {complexityLabel(currentGame.averageWeight)}
                      </span>
                    )}
                  </div>

                  {/* Action buttons */}
                  {done && (
                    <div className="mt-5 flex gap-3 animate-picker-fade-in">
                      <button
                        onClick={() => {
                          close();
                          router.push(`/game?id=${currentGame.id}`);
                        }}
                        className="flex-1 rounded-xl bg-forest py-2.5 text-center text-sm font-bold text-white shadow-md transition-all hover:bg-forest-dark hover:shadow-lg active:scale-95"
                      >
                        Spielen!
                      </button>
                      <button
                        onClick={spin}
                        className="flex-1 rounded-xl bg-warm-100 py-2.5 text-center text-sm font-bold text-warm-700 transition-all hover:bg-warm-200 active:scale-95"
                      >
                        Nochmal!
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="h-20" />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
