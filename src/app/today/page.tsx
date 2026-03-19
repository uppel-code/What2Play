"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import ScoredGameCard from "@/components/ScoredGameCard";
import { recommendGames, categorizeResults } from "@/services/recommendation";
import type { Game, TodayPlayParams, ScoredGame, Mood, Player, PlayGroup, CategorizedRecommendations } from "@/types/game";
import { getAllGames, getAllPlayers, getAllPlayGroups } from "@/lib/db-client";

type CategoryTab = "alle" | "schnell" | "party" | "anspruchsvoll";
type ViewMode = "flat" | "categorized";

const TABS: { key: CategoryTab; label: string; description: string }[] = [
  { key: "alle", label: "Alle", description: "Alle Empfehlungen" },
  { key: "schnell", label: "Schnell", description: "Unter 30 Minuten" },
  { key: "party", label: "Party", description: "5+ Spieler" },
  { key: "anspruchsvoll", label: "Anspruchsvoll", description: "Komplexität > 2.5" },
];

const MOODS: { key: Mood; emoji: string; label: string }[] = [
  { key: "relaxed", emoji: "\u{1F60C}", label: "Entspannt" },
  { key: "competitive", emoji: "\u{2694}\uFE0F", label: "Kompetitiv" },
  { key: "creative", emoji: "\u{1F3A8}", label: "Kreativ" },
];

function filterByCategory(games: ScoredGame[], tab: CategoryTab): ScoredGame[] {
  switch (tab) {
    case "schnell":
      return games.filter((g) => g.playingTime > 0 && g.playingTime < 30);
    case "party":
      return games.filter((g) => g.maxPlayers >= 5);
    case "anspruchsvoll":
      return games.filter((g) => g.averageWeight > 2.5);
    default:
      return games;
  }
}

export default function TodayPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [playGroups, setPlayGroups] = useState<PlayGroup[]>([]);
  const [results, setResults] = useState<ScoredGame[] | null>(null);
  const [categorized, setCategorized] = useState<CategorizedRecommendations | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<CategoryTab>("alle");
  const [viewMode, setViewMode] = useState<ViewMode>("categorized");
  const [shakeHint, setShakeHint] = useState(false);
  const lastShakeRef = useRef(0);

  const [params, setParams] = useState<TodayPlayParams>({
    playerCount: 3,
    availableTime: 90,
    desiredComplexity: 2.5,
    preferNewcomers: false,
  });

  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([getAllGames(), getAllPlayers(), getAllPlayGroups()])
      .then(([g, p, pg]) => {
        setGames(g);
        setPlayers(p);
        setPlayGroups(pg);
      })
      .finally(() => setLoading(false));
  }, []);

  // When a PlayGroup is selected, derive playerCount and maxGroupComplexity
  useEffect(() => {
    if (selectedGroupId == null) {
      setParams((prev) => ({ ...prev, maxGroupComplexity: undefined }));
      return;
    }

    const group = playGroups.find((g) => g.id === selectedGroupId);
    if (!group) return;

    const groupPlayers = players.filter((p) => group.playerIds.includes(p.id));
    const playerCount = groupPlayers.length || params.playerCount;

    const complexities = groupPlayers
      .map((p) => p.maxComplexity)
      .filter((c): c is number => c != null && c > 0);
    const maxGroupComplexity = complexities.length > 0 ? Math.min(...complexities) : undefined;

    setParams((prev) => ({
      ...prev,
      playerCount,
      maxGroupComplexity,
    }));
  }, [selectedGroupId, playGroups, players]);

  const handleSearch = useCallback(() => {
    const scored = recommendGames(games, params);
    setResults(scored);
    setCategorized(categorizeResults(scored));
    setActiveTab("alle");
  }, [games, params]);

  // Shake-to-refresh on mobile
  useEffect(() => {
    if (typeof window === "undefined" || !("DeviceMotionEvent" in window)) return;

    let shakeThreshold = 25;
    let lastX = 0, lastY = 0, lastZ = 0;
    let initialized = false;

    function handleMotion(e: DeviceMotionEvent) {
      const acc = e.accelerationIncludingGravity;
      if (!acc || acc.x == null || acc.y == null || acc.z == null) return;

      if (!initialized) {
        lastX = acc.x;
        lastY = acc.y;
        lastZ = acc.z;
        initialized = true;
        return;
      }

      const dx = Math.abs(acc.x - lastX);
      const dy = Math.abs(acc.y - lastY);
      const dz = Math.abs(acc.z - lastZ);

      lastX = acc.x;
      lastY = acc.y;
      lastZ = acc.z;

      if (dx + dy + dz > shakeThreshold) {
        const now = Date.now();
        if (now - lastShakeRef.current > 1500) {
          lastShakeRef.current = now;
          handleSearch();
          setShakeHint(true);
          setTimeout(() => setShakeHint(false), 1200);
        }
      }
    }

    window.addEventListener("devicemotion", handleMotion);
    return () => window.removeEventListener("devicemotion", handleMotion);
  }, [handleSearch]);

  const filteredResults = results ? filterByCategory(results, activeTab) : null;

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-warm-900">Heute spielen</h1>
          <p className="mt-1 text-sm font-medium text-warm-500">
            Finde das passende Spiel für eure Runde
          </p>
        </div>
        {shakeHint && (
          <div className="animate-fade-up rounded-xl bg-forest px-3 py-1.5 text-xs font-medium text-white shadow-lg">
            Neu gewürfelt!
          </div>
        )}
      </div>

      {/* Mood buttons */}
      <div className="mt-5 flex gap-2">
        {MOODS.map((mood) => (
          <button
            key={mood.key}
            onClick={() =>
              setParams((prev) => ({
                ...prev,
                mood: prev.mood === mood.key ? undefined : mood.key,
              }))
            }
            className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${
              params.mood === mood.key
                ? "bg-forest text-white shadow-sm ring-2 ring-forest/20"
                : "bg-warm-100 text-warm-600 hover:bg-warm-200"
            }`}
            data-testid={`mood-${mood.key}`}
          >
            <span className="mr-1.5">{mood.emoji}</span>
            {mood.label}
          </button>
        ))}
      </div>

      {/* Input form */}
      <div className="mt-4 rounded-2xl border border-warm-200/80 bg-surface p-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {/* PlayGroup selector */}
          {playGroups.length > 0 && (
            <div className="col-span-2 sm:col-span-4">
              <label className="mb-1.5 block text-xs font-semibold text-warm-500 uppercase tracking-wider">
                Wer spielt mit?
              </label>
              <select
                value={selectedGroupId ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedGroupId(val ? Number(val) : null);
                }}
                className="w-full rounded-xl border border-warm-200 bg-warm-50/50 px-3 py-2.5 text-sm font-medium text-warm-800 transition-colors focus:border-forest focus:bg-surface focus:outline-none focus:ring-2 focus:ring-forest/10"
                data-testid="playgroup-select"
              >
                <option value="">Manuell wählen...</option>
                {playGroups.map((g) => {
                  const count = g.playerIds.length;
                  return (
                    <option key={g.id} value={g.id}>
                      {g.name} ({count} Spieler)
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-warm-500 uppercase tracking-wider">
              Spieler
            </label>
            <select
              value={params.playerCount}
              onChange={(e) => setParams({ ...params, playerCount: Number(e.target.value) })}
              disabled={selectedGroupId != null}
              className="w-full rounded-xl border border-warm-200 bg-warm-50/50 px-3 py-2.5 text-sm font-medium text-warm-800 transition-colors focus:border-forest focus:bg-surface focus:outline-none focus:ring-2 focus:ring-forest/10 disabled:opacity-50"
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
              className="w-full rounded-xl border border-warm-200 bg-warm-50/50 px-3 py-2.5 text-sm font-medium text-warm-800 transition-colors focus:border-forest focus:bg-surface focus:outline-none focus:ring-2 focus:ring-forest/10"
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
              className="w-full rounded-xl border border-warm-200 bg-warm-50/50 px-3 py-2.5 text-sm font-medium text-warm-800 transition-colors focus:border-forest focus:bg-surface focus:outline-none focus:ring-2 focus:ring-forest/10"
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
            <EmptyState />
          ) : (
            <>
              {/* View mode toggle */}
              <div className="mb-4 flex items-center gap-2">
                <button
                  onClick={() => setViewMode("categorized")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                    viewMode === "categorized"
                      ? "bg-forest text-white"
                      : "bg-warm-100 text-warm-600 hover:bg-warm-200"
                  }`}
                >
                  Kategorien
                </button>
                <button
                  onClick={() => setViewMode("flat")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                    viewMode === "flat"
                      ? "bg-forest text-white"
                      : "bg-warm-100 text-warm-600 hover:bg-warm-200"
                  }`}
                >
                  Rangliste
                </button>
              </div>

              {viewMode === "categorized" && categorized ? (
                <CategorizedView categorized={categorized} />
              ) : (
                <>
                  {/* Category tabs */}
                  <div className="mb-5 flex gap-2 overflow-x-auto scrollbar-hide">
                    {TABS.map((tab) => {
                      const count = filterByCategory(results, tab.key).length;
                      return (
                        <button
                          key={tab.key}
                          onClick={() => setActiveTab(tab.key)}
                          className={`flex-shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                            activeTab === tab.key
                              ? "bg-forest text-white shadow-sm"
                              : "bg-warm-100 text-warm-600 hover:bg-warm-200"
                          }`}
                        >
                          {tab.label}
                          <span className={`ml-1.5 text-xs ${
                            activeTab === tab.key ? "text-white/70" : "text-warm-400"
                          }`}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {filteredResults && filteredResults.length === 0 ? (
                    <CategoryEmptyState tab={activeTab} onReset={() => setActiveTab("alle")} />
                  ) : (
                    <>
                      <h2 className="mb-4 font-display text-xl font-bold text-warm-900">
                        {filteredResults!.length} passende{filteredResults!.length === 1 ? "s" : ""} Spiel{filteredResults!.length === 1 ? "" : "e"}
                      </h2>
                      <div className="space-y-3">
                        {filteredResults!.map((game, i) => (
                          <div key={game.id} className="animate-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
                            <ScoredGameCard game={game} rank={i + 1} />
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CategorizedView({ categorized }: { categorized: CategorizedRecommendations }) {
  const sections: { key: string; title: string; icon: string; games: ScoredGame[] }[] = [
    { key: "lange", title: "Lange nicht gespielt", icon: "\u{1F4A4}", games: categorized.langeNichtGespielt },
    { key: "favoriten", title: "Eure Favoriten", icon: "\u2B50", games: categorized.favoriten },
    { key: "anders", title: "Mal was anderes?", icon: "\u{1F500}", games: categorized.malWasAnderes },
  ];

  const nonEmpty = sections.filter((s) => s.games.length > 0);

  if (nonEmpty.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-8">
      {nonEmpty.map((section) => (
        <div key={section.key}>
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-warm-900">
            <span>{section.icon}</span>
            {section.title}
            <span className="text-sm font-normal text-warm-400">({section.games.length})</span>
          </h2>
          <div className="space-y-3">
            {section.games.map((game, i) => (
              <div key={game.id} className="animate-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
                <ScoredGameCard game={game} rank={i + 1} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-warm-200/80 bg-surface p-10 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-warm-100">
        <svg className="h-7 w-7 text-warm-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <p className="mt-4 font-display text-lg font-semibold text-warm-700">Keine passenden Spiele gefunden</p>
      <p className="mt-2 text-sm text-warm-500 max-w-sm mx-auto">
        Das kann passieren! Hier ein paar Tipps:
      </p>
      <ul className="mt-4 space-y-2 text-left max-w-xs mx-auto">
        <li className="flex items-start gap-2 text-sm text-warm-600">
          <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-forest" />
          Mehr Zeit einplanen — viele Spiele brauchen über 60 Min.
        </li>
        <li className="flex items-start gap-2 text-sm text-warm-600">
          <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-forest" />
          Komplexität lockern — Mittel statt Leicht
        </li>
        <li className="flex items-start gap-2 text-sm text-warm-600">
          <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-forest" />
          Sammlung erweitern — neue Spiele über BGG suchen
        </li>
      </ul>
    </div>
  );
}

function CategoryEmptyState({ tab, onReset }: { tab: CategoryTab; onReset: () => void }) {
  const messages: Record<CategoryTab, string> = {
    alle: "",
    schnell: "Kein Spiel unter 30 Minuten passt zu euren Kriterien.",
    party: "Kein Spiel für 5+ Spieler passt zu euren Kriterien.",
    anspruchsvoll: "Kein anspruchsvolles Spiel (Komplexität > 2.5) passt zu euren Kriterien.",
  };

  return (
    <div className="rounded-2xl border border-dashed border-warm-300 bg-warm-50/50 p-8 text-center">
      <p className="text-sm font-medium text-warm-500">{messages[tab]}</p>
      <button
        onClick={onReset}
        className="mt-3 rounded-lg bg-warm-100 px-4 py-2 text-sm font-semibold text-warm-700 transition-colors hover:bg-warm-200"
      >
        Alle Ergebnisse anzeigen
      </button>
    </div>
  );
}
