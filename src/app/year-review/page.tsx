"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import type { Game, PlaySession, Player } from "@/types/game";
import { getAllGames, getAllSessions, getAllPlayers } from "@/lib/db-client";
import { computeYearReview, monthName } from "@/services/year-review";
import type { YearReviewStats } from "@/services/year-review";
import { computeGlobalStats } from "@/services/win-loss-stats";
import type { GlobalStats } from "@/services/win-loss-stats";
import BarChart from "@/components/BarChart";
import PieChart, { getPieColors } from "@/components/PieChart";

// ─── Animated Counter ───

function AnimatedNumber({ value, duration = 1200 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number | null>(null);

  useEffect(() => {
    if (value === 0) {
      setDisplay(0);
      return;
    }
    const start = performance.now();
    const from = 0;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (progress < 1) {
        ref.current = requestAnimationFrame(tick);
      }
    }

    ref.current = requestAnimationFrame(tick);
    return () => {
      if (ref.current) cancelAnimationFrame(ref.current);
    };
  }, [value, duration]);

  return <span>{display}</span>;
}

// ─── Share Image Generator ───

async function generateShareImage(stats: YearReviewStats): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, 1920);
  gradient.addColorStop(0, "#1A5C3A");
  gradient.addColorStop(1, "#0D2E1D");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1080, 1920);

  // Title
  ctx.fillStyle = "#D4A843";
  ctx.font = "bold 72px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`Mein Spielejahr ${stats.year}`, 540, 160);

  // Divider
  ctx.strokeStyle = "#D4A843";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(200, 200);
  ctx.lineTo(880, 200);
  ctx.stroke();

  // Stats
  ctx.fillStyle = "#FFFFFF";
  const items = [
    { icon: "🎮", label: "Partien gespielt", value: String(stats.totalGamesPlayed) },
    {
      icon: "🏆",
      label: "Meistgespielt",
      value: stats.mostPlayedGame
        ? `${stats.mostPlayedGame.game.name} (${stats.mostPlayedGame.count}x)`
        : "–",
    },
    { icon: "🆕", label: "Neue Spiele", value: String(stats.newGamesAdded) },
    { icon: "🕸️", label: "Shame Pile", value: `${stats.shamePileCount} Spiele` },
    {
      icon: "👥",
      label: "Liebster Mitspieler",
      value: stats.favoriteMitspieler
        ? `${stats.favoriteMitspieler.player.name} (${stats.favoriteMitspieler.count}x)`
        : "–",
    },
    {
      icon: "⚙️",
      label: "Liebste Mechanik",
      value: stats.favoriteMechanic ? stats.favoriteMechanic.mechanic : "–",
    },
    {
      icon: "📅",
      label: "Aktivster Monat",
      value: stats.activestMonth
        ? `${monthName(stats.activestMonth.month)} (${stats.activestMonth.count})`
        : "–",
    },
    {
      icon: "🔥",
      label: "Längste Streak",
      value: `${stats.longestStreak} Tage`,
    },
  ];

  let y = 300;
  for (const item of items) {
    ctx.font = "48px sans-serif";
    ctx.fillText(`${item.icon}  ${item.label}`, 540, y);
    ctx.font = "bold 56px sans-serif";
    ctx.fillStyle = "#D4A843";
    ctx.fillText(item.value, 540, y + 70);
    ctx.fillStyle = "#FFFFFF";
    y += 180;
  }

  // Footer
  ctx.fillStyle = "#FFFFFF80";
  ctx.font = "32px sans-serif";
  ctx.fillText("What2Play", 540, 1860);

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

// ─── Page ───

export default function YearReviewPage() {
  const [stats, setStats] = useState<YearReviewStats | null>(null);
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    Promise.all([getAllGames(), getAllSessions(), getAllPlayers()]).then(
      ([games, sessions, players]: [Game[], PlaySession[], Player[]]) => {
        const review = computeYearReview(currentYear, sessions, games, players);
        setStats(review);
        setGlobalStats(computeGlobalStats(sessions, games, players));
        setLoading(false);
      },
    );
  }, [currentYear]);

  const handleShare = useCallback(async () => {
    if (!stats) return;
    setSharing(true);
    try {
      const blob = await generateShareImage(stats);
      if (!blob) return;

      if (navigator.share && navigator.canShare) {
        const file = new File([blob], `spielejahr-${stats.year}.png`, { type: "image/png" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: `Mein Spielejahr ${stats.year}` });
          return;
        }
      }

      // Fallback: download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `spielejahr-${stats.year}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setSharing(false);
    }
  }, [stats]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-forest border-t-transparent" />
      </div>
    );
  }

  if (!stats || stats.totalGamesPlayed === 0) {
    return (
      <div className="space-y-6">
        <Header year={currentYear} />
        <div className="flex flex-col items-center gap-4 rounded-2xl bg-warm-50 p-8 text-center">
          <span className="text-5xl">🎲</span>
          <h2 className="font-display text-xl font-bold text-warm-900">
            Noch keine Partien in {currentYear}
          </h2>
          <p className="text-sm text-warm-500">
            Starte dein erstes Spiel um einen Rückblick zu bekommen!
          </p>
          <Link
            href="/today"
            className="mt-2 rounded-xl bg-forest px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-forest-dark"
          >
            Jetzt spielen
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8">
      <Header year={currentYear} />

      {/* Stats Cards */}
      <StatCard icon="🎮" label="Partien gespielt" testId="stat-total">
        <AnimatedNumber value={stats.totalGamesPlayed} />
      </StatCard>

      <StatCard icon="🏆" label="Meistgespieltes Spiel" testId="stat-most-played">
        {stats.mostPlayedGame ? (
          <div className="flex items-center gap-3">
            {stats.mostPlayedGame.game.thumbnail && (
              <img
                src={stats.mostPlayedGame.game.thumbnail}
                alt={stats.mostPlayedGame.game.name}
                className="h-14 w-14 rounded-xl object-cover"
              />
            )}
            <div>
              <p className="font-display text-lg font-bold text-warm-900">
                {stats.mostPlayedGame.game.name}
              </p>
              <p className="text-sm text-warm-500">
                <AnimatedNumber value={stats.mostPlayedGame.count} /> Partien
              </p>
            </div>
          </div>
        ) : (
          <span className="text-warm-400">–</span>
        )}
      </StatCard>

      <StatCard icon="🆕" label="Neue Spiele hinzugefügt" testId="stat-new-games">
        <AnimatedNumber value={stats.newGamesAdded} />
      </StatCard>

      <StatCard icon="🕸️" label="Shame Pile" testId="stat-shame">
        <div>
          <span className="font-display text-3xl font-bold text-warm-900">
            <AnimatedNumber value={stats.shamePileCount} />
          </span>
          <span className="ml-1 text-sm text-warm-500">nie gespielt</span>
        </div>
      </StatCard>

      <StatCard icon="👥" label="Liebster Mitspieler" testId="stat-mitspieler">
        {stats.favoriteMitspieler ? (
          <div>
            <p className="font-display text-2xl font-bold text-warm-900">
              {stats.favoriteMitspieler.player.name}
            </p>
            <p className="text-sm text-warm-500">
              <AnimatedNumber value={stats.favoriteMitspieler.count} />x gewonnen
            </p>
          </div>
        ) : (
          <span className="text-warm-400">Keine Gewinner erfasst</span>
        )}
      </StatCard>

      <StatCard icon="⚙️" label="Liebste Mechanik" testId="stat-mechanic">
        {stats.favoriteMechanic ? (
          <div>
            <p className="font-display text-2xl font-bold text-warm-900">
              {stats.favoriteMechanic.mechanic}
            </p>
            <p className="text-sm text-warm-500">
              <AnimatedNumber value={stats.favoriteMechanic.count} /> Partien
            </p>
          </div>
        ) : (
          <span className="text-warm-400">–</span>
        )}
      </StatCard>

      <StatCard icon="📅" label="Aktivster Monat" testId="stat-month">
        {stats.activestMonth ? (
          <div>
            <p className="font-display text-2xl font-bold text-warm-900">
              {monthName(stats.activestMonth.month)}
            </p>
            <p className="text-sm text-warm-500">
              <AnimatedNumber value={stats.activestMonth.count} /> Partien
            </p>
          </div>
        ) : (
          <span className="text-warm-400">–</span>
        )}
      </StatCard>

      <StatCard icon="🔥" label="Längste Streak" testId="stat-streak">
        <div>
          <span className="font-display text-3xl font-bold text-warm-900">
            <AnimatedNumber value={stats.longestStreak} />
          </span>
          <span className="ml-1 text-sm text-warm-500">Tage am Stück</span>
        </div>
      </StatCard>

      {/* Global Win/Loss Stats */}
      {globalStats && globalStats.totalSessions > 0 && (
        <>
          <div className="mt-2 border-t border-warm-200 pt-4 dark:border-warm-700">
            <h2 className="font-display text-lg font-bold text-warm-900 mb-3">Globale Statistiken</h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatCard icon="🎮" label="Total Sessions" testId="stat-global-sessions">
              <AnimatedNumber value={globalStats.totalSessions} />
            </StatCard>
            <StatCard icon="🎲" label="Unique Spiele" testId="stat-global-unique">
              <AnimatedNumber value={globalStats.uniqueGames} />
            </StatCard>
          </div>

          {globalStats.bestPlayer && (
            <StatCard icon="🏅" label="Bester Spieler (meiste Wins)" testId="stat-global-best">
              <div>
                <p className="font-display text-2xl font-bold text-warm-900">
                  {globalStats.bestPlayer.player.name}
                </p>
                <p className="text-sm text-warm-500">
                  <AnimatedNumber value={globalStats.bestPlayer.wins} /> Siege
                </p>
              </div>
            </StatCard>
          )}

          {globalStats.favoriteGame && (
            <StatCard icon="❤️" label="Favorite Game (meiste Sessions)" testId="stat-global-fav">
              <div className="flex items-center gap-3">
                {globalStats.favoriteGame.game.thumbnail && (
                  <img
                    src={globalStats.favoriteGame.game.thumbnail}
                    alt={globalStats.favoriteGame.game.name}
                    className="h-14 w-14 rounded-xl object-cover"
                  />
                )}
                <div>
                  <p className="font-display text-lg font-bold text-warm-900">
                    {globalStats.favoriteGame.game.name}
                  </p>
                  <p className="text-sm text-warm-500">
                    <AnimatedNumber value={globalStats.favoriteGame.count} /> Sessions
                  </p>
                </div>
              </div>
            </StatCard>
          )}

          {globalStats.winStreak && (
            <StatCard icon="🔥" label="Win Streak" testId="stat-global-streak">
              <div>
                <p className="font-display text-2xl font-bold text-warm-900">
                  {globalStats.winStreak.player.name}
                </p>
                <p className="text-sm text-warm-500">
                  <AnimatedNumber value={globalStats.winStreak.streak} /> Siege am Stück
                </p>
              </div>
            </StatCard>
          )}
        </>
      )}

      {/* Share Button */}
      <button
        data-testid="share-button"
        onClick={handleShare}
        disabled={sharing}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-forest py-4 text-base font-bold text-white shadow-md transition-all hover:bg-forest-dark disabled:opacity-50"
      >
        {sharing ? (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
        ) : (
          <>
            <span>📤</span>
            <span>Teile dein Spielejahr {currentYear}</span>
          </>
        )}
      </button>
    </div>
  );
}

// ─── Sub-components ───

function Header({ year }: { year: number }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="font-display text-2xl font-bold text-warm-900">
          Dein Spielejahr {year}
        </h1>
        <p className="mt-1 text-sm text-warm-500">Dein persönlicher Rückblick</p>
      </div>
      <Link
        href="/achievements"
        className="rounded-xl bg-warm-100 px-3 py-2 text-sm font-medium text-warm-600 hover:bg-warm-200"
      >
        Zurück
      </Link>
    </div>
  );
}

function StatCard({
  icon,
  label,
  children,
  testId,
}: {
  icon: string;
  label: string;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      className="rounded-2xl border border-warm-200 bg-white p-5 shadow-sm transition-all dark:border-warm-700 dark:bg-warm-800"
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="text-2xl">{icon}</span>
        <span className="text-sm font-medium text-warm-500">{label}</span>
      </div>
      <div className="font-display text-3xl font-bold text-warm-900">{children}</div>
    </div>
  );
}
