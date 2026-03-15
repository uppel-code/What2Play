"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { BggGameData, BggSearchResult } from "@/types/game";
import { createGame, getGameByBggId } from "@/lib/db-client";
import { searchBgg as bggSearch, fetchBggThing, fetchBggCollection, isBggConfigured } from "@/services/bgg-client";
import { isAiConfigured, recognizeGamesFromImage, compressImage } from "@/services/ai-client";
import type { RecognizedGame } from "@/services/ai-client";

type ActiveTab = "bgg-search" | "bgg-collection" | "bgg-bulk" | "photo-scan" | "manual";

export default function AddGamePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>("bgg-search");

  return (
    <div>
      <h1 className="font-display text-3xl font-bold tracking-tight text-warm-900">Spiel hinzufügen</h1>
      <p className="mt-1 text-sm font-medium text-warm-500">Erweitere deine Sammlung</p>

      {/* Tabs */}
      <div className="mt-5 flex gap-1 rounded-2xl bg-warm-100 p-1 overflow-x-auto">
        <TabButton active={activeTab === "bgg-search"} onClick={() => setActiveTab("bgg-search")}>
          BGG Suche
        </TabButton>
        <TabButton active={activeTab === "photo-scan"} onClick={() => setActiveTab("photo-scan")}>
          Foto-Scan
        </TabButton>
        <TabButton active={activeTab === "bgg-collection"} onClick={() => setActiveTab("bgg-collection")}>
          Sammlung
        </TabButton>
        <TabButton active={activeTab === "bgg-bulk"} onClick={() => setActiveTab("bgg-bulk")}>
          IDs
        </TabButton>
        <TabButton active={activeTab === "manual"} onClick={() => setActiveTab("manual")}>
          Manuell
        </TabButton>
      </div>

      {activeTab === "bgg-search" && <BggSearchTab router={router} />}
      {activeTab === "photo-scan" && <PhotoScanTab />}
      {activeTab === "bgg-collection" && <BggCollectionTab router={router} />}
      {activeTab === "bgg-bulk" && <BggBulkTab />}
      {activeTab === "manual" && <ManualTab router={router} />}
    </div>
  );
}

// ─── Tab Button ───

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition-all ${
        active
          ? "bg-white text-warm-900 shadow-sm"
          : "text-warm-500 hover:text-warm-700"
      }`}
    >
      {children}
    </button>
  );
}

// ─── BGG Token Setup Banner ───

function BggSetupBanner() {
  return (
    <div className="mt-5 rounded-2xl border border-amber/30 bg-amber-light p-5">
      <div className="flex gap-3">
        <svg className="h-5 w-5 flex-shrink-0 text-amber-dark mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <div>
          <h3 className="text-sm font-semibold text-warm-900">BGG API-Token benötigt</h3>
          <p className="mt-1 text-sm text-warm-600">
            Um Spiele von BoardGameGeek zu suchen und importieren, brauchst du einen API-Token.
          </p>
          <a
            href="/settings"
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-forest-dark hover:shadow-md active:scale-[0.98]"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Token in Einstellungen einrichten
          </a>
          <p className="mt-3 text-xs text-warm-500">
            Du kannst Spiele trotzdem manuell hinzufügen (Tab &quot;Manuell&quot;).
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── BGG Search Tab ───

function BggSearchTab({ router }: { router: ReturnType<typeof useRouter> }) {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<BggSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedGame, setSelectedGame] = useState<BggGameData | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bggConfigured, setBggConfigured] = useState<boolean | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    isBggConfigured().then(setBggConfigured).catch(() => setBggConfigured(false));
  }, []);

  const doSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    setError(null);
    try {
      const results = await bggSearch(searchQuery.trim());
      setSearchResults(results);
    } catch (err) {
      if (err instanceof Error) {
        if (err.message === "BGG_API_TOKEN_MISSING") {
          setBggConfigured(false);
        } else if (err.message === "BGG_API_TOKEN_INVALID") {
          setError("Der BGG API-Token ist ungültig oder abgelaufen.");
        } else {
          setError("BGG-Suche fehlgeschlagen. Bitte versuche es erneut.");
        }
      }
    } finally {
      setSearching(false);
    }
  }, []);

  function handleQueryChange(value: string) {
    setQuery(value);
    setSelectedGame(null);
    setError(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 400);
  }

  async function handleSelectResult(result: BggSearchResult) {
    setLoadingDetails(true);
    setSearchResults([]);
    setQuery(result.name);
    setError(null);

    try {
      const data = await fetchBggThing(result.bggId);
      if (data) {
        setSelectedGame(data);
      } else {
        setError("Spieldetails konnten nicht geladen werden.");
      }
    } catch {
      setError("Verbindung zu BGG fehlgeschlagen.");
    } finally {
      setLoadingDetails(false);
    }
  }

  async function handleAddGame() {
    if (!selectedGame) return;

    setSaving(true);
    try {
      const game = await createGame({
        bggId: selectedGame.bggId,
        name: selectedGame.name,
        yearpublished: selectedGame.yearpublished,
        minPlayers: selectedGame.minPlayers,
        maxPlayers: selectedGame.maxPlayers,
        playingTime: selectedGame.playingTime,
        minPlayTime: selectedGame.minPlayTime,
        maxPlayTime: selectedGame.maxPlayTime,
        minAge: selectedGame.minAge,
        averageWeight: selectedGame.averageWeight,
        thumbnail: selectedGame.thumbnail,
        image: selectedGame.image,
        categories: selectedGame.categories,
        mechanics: selectedGame.mechanics,
        owned: true,
      });
      router.push(`/game?id=${game.id}`);
    } catch (err) {
      if (err instanceof Error && err.message.includes("ConstraintError")) {
        setError("Dieses Spiel ist bereits in deiner Sammlung.");
      }
      setSaving(false);
    }
  }

  function handleReset() {
    setQuery("");
    setSearchResults([]);
    setSelectedGame(null);
    setError(null);
  }

  if (bggConfigured === false) {
    return <BggSetupBanner />;
  }

  if (bggConfigured === null) {
    return (
      <div className="mt-5 flex items-center gap-2.5 rounded-2xl border border-warm-200/80 bg-white p-5 text-sm text-warm-500">
        <div className="spinner" />
        Prüfe BGG-Verbindung...
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="rounded-2xl border border-warm-200/80 bg-white p-5">
        <p className="mb-3 text-sm text-warm-500">
          Suche nach einem Brettspiel auf BoardGameGeek – alle Infos werden automatisch übernommen.
        </p>

        <div className="relative">
          <svg className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-warm-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Spielname eingeben, z.B. Ark Nova, Wingspan..."
            className="w-full rounded-xl border border-warm-200 bg-warm-50/50 py-2.5 pl-10 pr-10 text-sm text-warm-800 placeholder:text-warm-400 transition-colors focus:border-forest focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest/10"
            autoFocus
          />
          {(query || selectedGame) && (
            <button
              onClick={handleReset}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-400 transition-colors hover:text-warm-600"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {searching && (
          <div className="mt-3 flex items-center gap-2.5 text-sm text-warm-500">
            <div className="spinner" />
            Suche auf BGG...
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-xl bg-coral-light px-4 py-2.5 text-sm text-coral">
            {error}
          </div>
        )}

        {searchResults.length > 0 && !selectedGame && (
          <div className="mt-2 max-h-72 overflow-y-auto rounded-xl border border-warm-200 bg-white">
            {searchResults.map((result) => (
              <button
                key={result.bggId}
                onClick={() => handleSelectResult(result)}
                className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors hover:bg-forest-light border-b border-warm-100 last:border-b-0"
              >
                <span className="font-medium text-warm-900">{result.name}</span>
                {result.yearpublished && (
                  <span className="ml-2 flex-shrink-0 text-xs text-warm-500">
                    ({result.yearpublished})
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {!searching && !error && searchResults.length === 0 && query.length >= 2 && !selectedGame && (
          <p className="mt-3 text-sm text-warm-400">Keine Ergebnisse auf BGG gefunden.</p>
        )}
      </div>

      {loadingDetails && (
        <div className="flex items-center gap-3 rounded-2xl border border-warm-200/80 bg-white p-6">
          <div className="spinner" />
          <span className="text-sm text-warm-500">Lade Spieldetails von BGG...</span>
        </div>
      )}

      {selectedGame && (
        <div className="rounded-2xl border border-forest/20 bg-forest-light p-5">
          <div className="flex gap-4">
            <div className="h-28 w-28 flex-shrink-0 overflow-hidden rounded-xl bg-warm-100">
              {selectedGame.thumbnail ? (
                <img src={selectedGame.thumbnail} alt={selectedGame.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-warm-300">
                  <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="font-display text-lg font-bold text-warm-900">{selectedGame.name}</h3>
              {selectedGame.yearpublished && (
                <p className="text-sm font-medium text-warm-500">({selectedGame.yearpublished})</p>
              )}

              <div className="mt-2.5 flex flex-wrap gap-2 text-xs">
                <InfoPill icon="players" text={`${selectedGame.minPlayers}–${selectedGame.maxPlayers} Spieler`} />
                <InfoPill icon="time" text={`${selectedGame.playingTime} Min`} />
                <InfoPill icon="weight" text={`Komplexität ${selectedGame.averageWeight.toFixed(1)}`} />
                {selectedGame.minAge > 0 && (
                  <InfoPill icon="age" text={`Ab ${selectedGame.minAge} Jahren`} />
                )}
              </div>

              {selectedGame.categories.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {selectedGame.categories.slice(0, 5).map((cat) => (
                    <span key={cat} className="rounded-lg bg-white/80 px-2 py-0.5 text-[10px] font-medium text-warm-600 ring-1 ring-warm-200/60">
                      {cat}
                    </span>
                  ))}
                  {selectedGame.categories.length > 5 && (
                    <span className="text-[10px] text-warm-400">+{selectedGame.categories.length - 5} weitere</span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={handleAddGame}
              disabled={saving}
              className="flex-1 rounded-xl bg-forest px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-forest-dark hover:shadow-md disabled:opacity-50 active:scale-[0.98] sm:flex-none"
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Wird hinzugefügt...
                </span>
              ) : (
                "Zur Sammlung hinzufügen"
              )}
            </button>
            <button
              onClick={handleReset}
              className="rounded-xl bg-white px-5 py-2.5 text-sm font-medium text-warm-600 ring-1 ring-warm-200/60 transition-colors hover:bg-warm-50"
            >
              Anderes Spiel suchen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoPill({ icon, text }: { icon: string; text: string }) {
  const iconMap: Record<string, React.ReactNode> = {
    players: (
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    time: (
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    weight: (
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
      </svg>
    ),
    age: (
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  };

  return (
    <span className="inline-flex items-center gap-1 rounded-lg bg-white/80 px-2.5 py-1 text-warm-700 ring-1 ring-warm-200/60">
      {iconMap[icon]}
      {text}
    </span>
  );
}

// ─── BGG Collection Import Tab ───

function BggCollectionTab({ router }: { router: ReturnType<typeof useRouter> }) {
  const [bggUsername, setBggUsername] = useState("");
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<"success" | "error" | "info">("info");
  const [bggConfigured, setBggConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    isBggConfigured().then(setBggConfigured).catch(() => setBggConfigured(false));
  }, []);

  async function handleImport() {
    if (!bggUsername.trim()) return;

    setImporting(true);
    setStatus("Lade Sammlung von BGG...");
    setStatusType("info");

    try {
      const result = await fetchBggCollection(bggUsername);

      if (result.errors.includes("BGG_API_TOKEN_INVALID")) {
        setStatus("BGG API-Token ist ungültig oder abgelaufen.");
        setStatusType("error");
      } else if (result.queued) {
        setStatus("BGG bereitet deine Sammlung vor. Bitte versuche es in 10 Sekunden erneut.");
        setStatusType("info");
      } else if (result.success && result.games.length > 0) {
        let imported = 0;
        let skipped = 0;
        for (const game of result.games) {
          const existing = await getGameByBggId(game.bggId);
          if (existing) {
            skipped++;
            continue;
          }
          await createGame({
            bggId: game.bggId,
            name: game.name,
            yearpublished: game.yearpublished,
            minPlayers: game.minPlayers,
            maxPlayers: game.maxPlayers,
            playingTime: game.playingTime,
            minPlayTime: game.minPlayTime,
            maxPlayTime: game.maxPlayTime,
            minAge: game.minAge,
            averageWeight: game.averageWeight,
            thumbnail: game.thumbnail,
            image: game.image,
            categories: game.categories,
            mechanics: game.mechanics,
            owned: true,
          });
          imported++;
        }
        setStatus(`${imported} Spiele importiert, ${skipped} übersprungen.`);
        setStatusType("success");
        if (imported > 0) {
          setTimeout(() => router.push("/"), 1500);
        }
      } else if (result.errors.length > 0) {
        setStatus(`Fehler: ${result.errors[0]}`);
        setStatusType("error");
      } else {
        setStatus("Keine Spiele gefunden.");
        setStatusType("info");
      }
    } catch (err) {
      if (err instanceof Error && err.message === "BGG_API_TOKEN_MISSING") {
        setBggConfigured(false);
      } else {
        setStatus("Import fehlgeschlagen.");
        setStatusType("error");
      }
    }

    setImporting(false);
  }

  if (bggConfigured === false) {
    return <BggSetupBanner />;
  }

  return (
    <div className="mt-5 rounded-2xl border border-warm-200/80 bg-white p-5">
      <p className="text-sm text-warm-500">
        Importiere deine komplette Sammlung von BoardGameGeek auf einmal.
      </p>

      <div className="mt-4 flex gap-2">
        <input
          type="text"
          value={bggUsername}
          onChange={(e) => setBggUsername(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleImport()}
          placeholder="BGG Benutzername"
          className="flex-1 rounded-xl border border-warm-200 bg-warm-50/50 px-3.5 py-2.5 text-sm text-warm-800 placeholder:text-warm-400 transition-colors focus:border-forest focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest/10"
        />
        <button
          onClick={handleImport}
          disabled={importing || !bggUsername.trim()}
          className="rounded-xl bg-forest px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-forest-dark hover:shadow-md disabled:opacity-50 active:scale-[0.98]"
        >
          {importing ? "Importiere..." : "Importieren"}
        </button>
      </div>

      {status && (
        <p className={`mt-3 text-sm font-medium ${
          statusType === "error" ? "text-coral" :
          statusType === "success" ? "text-forest" :
          "text-warm-600"
        }`}>
          {status}
        </p>
      )}

      <p className="mt-4 text-xs text-warm-400">
        Hinweis: BGG kann beim ersten Aufruf etwas Zeit brauchen (202-Antwort).
        Einfach nach ein paar Sekunden erneut versuchen.
      </p>
    </div>
  );
}

// ─── BGG Bulk Import Tab ───

interface BulkResult {
  bggId: number;
  name: string;
  status: "imported" | "skipped" | "failed";
}

function BggBulkTab() {
  const [input, setInput] = useState("");
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<BulkResult[] | null>(null);
  const [summary, setSummary] = useState<{ imported: number; skipped: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bggConfigured, setBggConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    isBggConfigured().then(setBggConfigured).catch(() => setBggConfigured(false));
  }, []);

  const parsedIds = input
    .split(/[\s,;]+/)
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0);
  const uniqueIds = [...new Set(parsedIds)];

  async function handleImport() {
    if (uniqueIds.length === 0) return;

    setImporting(true);
    setError(null);
    setResults(null);
    setSummary(null);

    const bulkResults: BulkResult[] = [];
    let imported = 0;
    let skipped = 0;
    let failed = 0;

    try {
      for (const bggId of uniqueIds) {
        // Check duplicate
        const existing = await getGameByBggId(bggId);
        if (existing) {
          bulkResults.push({ bggId, name: existing.name, status: "skipped" });
          skipped++;
          continue;
        }

        try {
          const data = await fetchBggThing(bggId);
          if (data) {
            await createGame({
              bggId: data.bggId,
              name: data.name,
              yearpublished: data.yearpublished,
              minPlayers: data.minPlayers,
              maxPlayers: data.maxPlayers,
              playingTime: data.playingTime,
              minPlayTime: data.minPlayTime,
              maxPlayTime: data.maxPlayTime,
              minAge: data.minAge,
              averageWeight: data.averageWeight,
              thumbnail: data.thumbnail,
              image: data.image,
              categories: data.categories,
              mechanics: data.mechanics,
              owned: true,
            });
            bulkResults.push({ bggId, name: data.name, status: "imported" });
            imported++;
          } else {
            bulkResults.push({ bggId, name: `ID ${bggId}`, status: "failed" });
            failed++;
          }
        } catch (err) {
          if (err instanceof Error && err.message.startsWith("BGG_API_TOKEN")) {
            setError(err.message === "BGG_API_TOKEN_MISSING" ? "BGG Token fehlt." : "BGG Token ungültig.");
            break;
          }
          bulkResults.push({ bggId, name: `ID ${bggId}`, status: "failed" });
          failed++;
        }
      }

      setResults(bulkResults);
      setSummary({ imported, skipped, failed });
    } catch {
      setError("Verbindung fehlgeschlagen.");
    } finally {
      setImporting(false);
    }
  }

  function handleReset() {
    setInput("");
    setResults(null);
    setSummary(null);
    setError(null);
  }

  if (bggConfigured === false) {
    return <BggSetupBanner />;
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="rounded-2xl border border-warm-200/80 bg-white p-5">
        <p className="mb-3 text-sm text-warm-500">
          Füge viele Spiele auf einmal hinzu, indem du ihre BGG-IDs eingibst.
          Die ID findest du in der URL eines Spiels auf boardgamegeek.com (z.B. <code className="rounded-lg bg-warm-100 px-1.5 py-0.5 text-xs font-mono text-warm-700">boardgamegeek.com/boardgame/<strong>342942</strong>/ark-nova</code>).
        </p>

        <textarea
          value={input}
          onChange={(e) => { setInput(e.target.value); setResults(null); setSummary(null); setError(null); }}
          placeholder={"BGG-IDs eingeben (komma-, leerzeichen- oder zeilengetrennt)\nz.B.: 342942, 266192, 167791"}
          rows={5}
          className="w-full rounded-xl border border-warm-200 bg-warm-50/50 px-3.5 py-2.5 text-sm font-mono text-warm-800 placeholder:text-warm-400 transition-colors focus:border-forest focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest/10"
          disabled={importing}
        />

        <div className="mt-3 flex items-center justify-between">
          <p className="text-sm text-warm-500">
            {uniqueIds.length > 0 ? (
              <span className="font-medium text-warm-700">{uniqueIds.length} gültige ID{uniqueIds.length !== 1 ? "s" : ""} erkannt</span>
            ) : (
              input.trim() ? "Keine gültigen IDs erkannt" : "Noch keine IDs eingegeben"
            )}
            {uniqueIds.length > 200 && (
              <span className="ml-2 text-coral">(max. 200)</span>
            )}
          </p>

          <div className="flex gap-2">
            {(results || input) && (
              <button
                onClick={handleReset}
                disabled={importing}
                className="rounded-xl bg-warm-100 px-4 py-2 text-sm font-medium text-warm-600 transition-colors hover:bg-warm-200 disabled:opacity-50"
              >
                Zurücksetzen
              </button>
            )}
            <button
              onClick={handleImport}
              disabled={importing || uniqueIds.length === 0 || uniqueIds.length > 200}
              className="rounded-xl bg-forest px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-forest-dark hover:shadow-md disabled:opacity-50 active:scale-[0.98]"
            >
              {importing ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Importiere...
                </span>
              ) : (
                `${uniqueIds.length} Spiel${uniqueIds.length !== 1 ? "e" : ""} importieren`
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-xl bg-coral-light px-4 py-2.5 text-sm text-coral">
            {error}
          </div>
        )}
      </div>

      {summary && results && (
        <div className="rounded-2xl border border-warm-200/80 bg-white p-5">
          <div className="flex flex-wrap gap-2.5 text-sm">
            {summary.imported > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-forest-light px-3.5 py-1.5 font-medium text-forest ring-1 ring-forest/20">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                {summary.imported} importiert
              </span>
            )}
            {summary.skipped > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-warm-50 px-3.5 py-1.5 font-medium text-warm-600 ring-1 ring-warm-200/60">
                {summary.skipped} übersprungen
              </span>
            )}
            {summary.failed > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-coral-light px-3.5 py-1.5 font-medium text-coral ring-1 ring-coral/20">
                {summary.failed} fehlgeschlagen
              </span>
            )}
          </div>

          <div className="mt-4 max-h-64 overflow-y-auto rounded-xl border border-warm-100">
            {results.map((r, i) => (
              <div
                key={`${r.bggId}-${i}`}
                className={`flex items-center justify-between border-b border-warm-100 px-4 py-2.5 text-sm last:border-b-0 ${
                  r.status === "imported" ? "bg-forest-light/50" :
                  r.status === "failed" ? "bg-coral-light/50" :
                  ""
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex-shrink-0 font-mono text-xs text-warm-400">{r.bggId}</span>
                  <span className="truncate text-warm-900">{r.name}</span>
                </div>
                <span className={`flex-shrink-0 text-xs font-semibold ${
                  r.status === "imported" ? "text-forest" :
                  r.status === "failed" ? "text-coral" :
                  "text-warm-500"
                }`}>
                  {r.status === "imported" ? "Importiert" :
                   r.status === "skipped" ? "Übersprungen" :
                   "Fehlgeschlagen"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Photo Scan Tab ───

interface BggMatch {
  recognized: RecognizedGame;
  bggResult: BggSearchResult | null;
  bggData: BggGameData | null;
  selected: boolean;
  status: "pending" | "searching" | "found" | "not_found" | "imported" | "skipped" | "failed";
}

function PhotoScanTab() {
  const [aiReady, setAiReady] = useState<boolean | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState("");
  const [matches, setMatches] = useState<BggMatch[]>([]);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<{ imported: number; skipped: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    isAiConfigured().then(setAiReady).catch(() => setAiReady(false));
  }, []);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setMatches([]);
    setImportSummary(null);

    // Show preview
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    // Compress and analyze
    setAnalyzing(true);
    setAnalyzeProgress("Bild wird komprimiert...");

    try {
      const base64 = await compressImage(file);

      setAnalyzeProgress("AI analysiert das Foto...");
      const recognized = await recognizeGamesFromImage(base64);

      if (recognized.length === 0) {
        setError("Keine Spiele auf dem Foto erkannt. Versuche ein deutlicheres Foto mit sichtbaren Spieletiteln.");
        setAnalyzing(false);
        return;
      }

      // Initialize matches
      const initialMatches: BggMatch[] = recognized.map((r) => ({
        recognized: r,
        bggResult: null,
        bggData: null,
        selected: true,
        status: "pending" as const,
      }));
      setMatches(initialMatches);

      // Search BGG for each recognized game
      setAnalyzeProgress(`Suche ${recognized.length} Spiele auf BGG...`);

      for (let i = 0; i < recognized.length; i++) {
        const game = recognized[i];

        setMatches((prev) =>
          prev.map((m, idx) => (idx === i ? { ...m, status: "searching" } : m))
        );

        try {
          const results = await bggSearch(game.name);
          if (results.length > 0) {
            // Fetch full details for best match
            const details = await fetchBggThing(results[0].bggId);
            setMatches((prev) =>
              prev.map((m, idx) =>
                idx === i
                  ? { ...m, bggResult: results[0], bggData: details, status: "found" }
                  : m
              )
            );
          } else {
            setMatches((prev) =>
              prev.map((m, idx) => (idx === i ? { ...m, status: "not_found" } : m))
            );
          }
        } catch {
          setMatches((prev) =>
            prev.map((m, idx) => (idx === i ? { ...m, status: "not_found" } : m))
          );
        }
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.message === "AI_NOT_CONFIGURED") {
          setAiReady(false);
        } else if (err.message === "AI_INVALID_KEY") {
          setError("Der AI API-Key ist ungültig. Bitte prüfe ihn in den Einstellungen.");
        } else if (err.message === "AI_RATE_LIMIT") {
          setError("AI Rate-Limit erreicht. Bitte warte einen Moment und versuche es erneut.");
        } else {
          setError(`Analyse fehlgeschlagen: ${err.message}`);
        }
      }
    } finally {
      setAnalyzing(false);
      setAnalyzeProgress("");
    }
  }

  function toggleMatch(index: number) {
    setMatches((prev) =>
      prev.map((m, i) => (i === index ? { ...m, selected: !m.selected } : m))
    );
  }

  function toggleAll() {
    const foundMatches = matches.filter((m) => m.status === "found" && m.bggData);
    const allSelected = foundMatches.every((m) => m.selected);
    setMatches((prev) =>
      prev.map((m) =>
        m.status === "found" && m.bggData ? { ...m, selected: !allSelected } : m
      )
    );
  }

  async function handleImport() {
    const toImport = matches.filter((m) => m.selected && m.bggData && m.status === "found");
    if (toImport.length === 0) return;

    setImporting(true);
    setError(null);
    let imported = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < matches.length; i++) {
      const m = matches[i];
      if (!m.selected || !m.bggData || m.status !== "found") continue;

      try {
        const existing = await getGameByBggId(m.bggData.bggId);
        if (existing) {
          setMatches((prev) =>
            prev.map((match, idx) => (idx === i ? { ...match, status: "skipped" } : match))
          );
          skipped++;
          continue;
        }

        await createGame({
          bggId: m.bggData.bggId,
          name: m.bggData.name,
          yearpublished: m.bggData.yearpublished,
          minPlayers: m.bggData.minPlayers,
          maxPlayers: m.bggData.maxPlayers,
          playingTime: m.bggData.playingTime,
          minPlayTime: m.bggData.minPlayTime,
          maxPlayTime: m.bggData.maxPlayTime,
          minAge: m.bggData.minAge,
          averageWeight: m.bggData.averageWeight,
          thumbnail: m.bggData.thumbnail,
          image: m.bggData.image,
          categories: m.bggData.categories,
          mechanics: m.bggData.mechanics,
          owned: true,
        });
        setMatches((prev) =>
          prev.map((match, idx) => (idx === i ? { ...match, status: "imported" } : match))
        );
        imported++;
      } catch {
        setMatches((prev) =>
          prev.map((match, idx) => (idx === i ? { ...match, status: "failed" } : match))
        );
        failed++;
      }
    }

    setImportSummary({ imported, skipped, failed });
    setImporting(false);
  }

  function handleReset() {
    setImagePreview(null);
    setMatches([]);
    setError(null);
    setImportSummary(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // AI not configured
  if (aiReady === false) {
    return (
      <div className="mt-5 rounded-2xl border border-amber/30 bg-amber-light p-5">
        <div className="flex gap-3">
          <svg className="h-5 w-5 flex-shrink-0 text-amber-dark mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <div>
            <h3 className="text-sm font-semibold text-warm-900">AI-Provider einrichten</h3>
            <p className="mt-1 text-sm text-warm-600">
              Für den Foto-Scan brauchst du einen AI-API-Key. Google Gemini ist kostenlos.
            </p>
            <a
              href="/settings"
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-forest-dark hover:shadow-md active:scale-[0.98]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              AI-Provider in Einstellungen einrichten
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (aiReady === null) {
    return (
      <div className="mt-5 flex items-center gap-2.5 rounded-2xl border border-warm-200/80 bg-white p-5 text-sm text-warm-500">
        <div className="spinner" />
        Prüfe AI-Konfiguration...
      </div>
    );
  }

  const foundMatches = matches.filter((m) => m.status === "found" && m.bggData);
  const selectedCount = matches.filter((m) => m.selected && m.status === "found" && m.bggData).length;

  return (
    <div className="mt-5 space-y-4">
      {/* Upload area */}
      <div className="rounded-2xl border border-warm-200/80 bg-white p-5">
        <p className="mb-3 text-sm text-warm-500">
          Fotografiere dein Spieleregal — die AI erkennt die Spiele und sucht sie auf BGG.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
        />

        {!imagePreview && !analyzing && (
          <div className="flex gap-3">
            <button
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.setAttribute("capture", "environment");
                  fileInputRef.current.click();
                }
              }}
              className="flex-1 flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-warm-300 p-6 text-warm-500 transition-all hover:border-forest hover:text-forest hover:bg-forest-light/30"
            >
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-sm font-medium">Foto aufnehmen</span>
            </button>

            <button
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.removeAttribute("capture");
                  fileInputRef.current.click();
                }
              }}
              className="flex-1 flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-warm-300 p-6 text-warm-500 transition-all hover:border-forest hover:text-forest hover:bg-forest-light/30"
            >
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm font-medium">Bild auswählen</span>
            </button>
          </div>
        )}

        {imagePreview && (
          <div className="relative">
            <img
              src={imagePreview}
              alt="Foto der Spielesammlung"
              className="w-full rounded-xl object-cover max-h-64"
            />
            {!analyzing && matches.length === 0 && (
              <button
                onClick={handleReset}
                className="absolute top-2 right-2 rounded-full bg-warm-900/60 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-warm-900/80"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        {analyzing && (
          <div className="mt-4 flex items-center gap-3">
            <div className="spinner" />
            <span className="text-sm font-medium text-warm-600">{analyzeProgress}</span>
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-xl bg-coral-light px-4 py-2.5 text-sm text-coral">
            {error}
          </div>
        )}
      </div>

      {/* Results */}
      {matches.length > 0 && !importing && !importSummary && (
        <div className="rounded-2xl border border-warm-200/80 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-base font-bold text-warm-900">
              {matches.length} Spiel{matches.length !== 1 ? "e" : ""} erkannt
            </h3>
            {foundMatches.length > 1 && (
              <button onClick={toggleAll} className="text-xs font-medium text-forest hover:text-forest-dark transition-colors">
                {foundMatches.every((m) => m.selected) ? "Alle abwählen" : "Alle auswählen"}
              </button>
            )}
          </div>

          <div className="space-y-2">
            {matches.map((m, i) => (
              <div
                key={`${m.recognized.name}-${i}`}
                className={`flex items-center gap-3 rounded-xl p-3 transition-colors ${
                  m.status === "found" ? "bg-forest-light/30" :
                  m.status === "not_found" ? "bg-warm-50" :
                  m.status === "searching" ? "bg-warm-50" :
                  "bg-warm-50"
                }`}
              >
                {/* Checkbox */}
                {m.status === "found" && m.bggData && (
                  <button
                    onClick={() => toggleMatch(i)}
                    className={`flex-shrink-0 h-5 w-5 rounded-md border-2 transition-all flex items-center justify-center ${
                      m.selected
                        ? "border-forest bg-forest text-white"
                        : "border-warm-300 bg-white"
                    }`}
                  >
                    {m.selected && (
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                )}

                {/* Thumbnail */}
                {m.bggData?.thumbnail ? (
                  <div className="flex-shrink-0 h-12 w-12 rounded-lg overflow-hidden bg-warm-100">
                    <img src={m.bggData.thumbnail} alt={m.bggData.name} className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <div className="flex-shrink-0 h-12 w-12 rounded-lg bg-warm-100 flex items-center justify-center">
                    {m.status === "searching" ? (
                      <div className="spinner" />
                    ) : (
                      <svg className="h-5 w-5 text-warm-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    )}
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-warm-900 truncate">
                    {m.bggData?.name || m.recognized.name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {m.bggData?.yearpublished && (
                      <span className="text-xs text-warm-500">({m.bggData.yearpublished})</span>
                    )}
                    {m.status === "found" && m.recognized.name !== m.bggData?.name && (
                      <span className="text-[10px] text-warm-400">AI: &quot;{m.recognized.name}&quot;</span>
                    )}
                    {m.status === "searching" && (
                      <span className="text-xs text-warm-400">Suche auf BGG...</span>
                    )}
                    {m.status === "not_found" && (
                      <span className="text-xs text-coral">Nicht auf BGG gefunden</span>
                    )}
                  </div>
                </div>

                {/* Confidence badge */}
                <span className={`flex-shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-semibold ${
                  m.recognized.confidence === "high" ? "bg-forest-light text-forest" :
                  m.recognized.confidence === "medium" ? "bg-amber-light text-amber-dark" :
                  "bg-warm-100 text-warm-500"
                }`}>
                  {m.recognized.confidence === "high" ? "Sicher" :
                   m.recognized.confidence === "medium" ? "Wahrscheinlich" :
                   "Unsicher"}
                </span>
              </div>
            ))}
          </div>

          {/* Import button */}
          {selectedCount > 0 && (
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleImport}
                className="flex-1 rounded-xl bg-forest px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-forest-dark hover:shadow-md active:scale-[0.98] sm:flex-none"
              >
                {selectedCount} Spiel{selectedCount !== 1 ? "e" : ""} importieren
              </button>
              <button
                onClick={handleReset}
                className="rounded-xl bg-warm-100 px-4 py-2 text-sm font-medium text-warm-600 transition-colors hover:bg-warm-200"
              >
                Neues Foto
              </button>
            </div>
          )}

          {selectedCount === 0 && foundMatches.length > 0 && (
            <p className="mt-3 text-sm text-warm-400">Wähle mindestens ein Spiel zum Importieren aus.</p>
          )}
        </div>
      )}

      {/* Import progress */}
      {importing && (
        <div className="flex items-center gap-3 rounded-2xl border border-warm-200/80 bg-white p-5">
          <div className="spinner" />
          <span className="text-sm font-medium text-warm-600">Importiere Spiele...</span>
        </div>
      )}

      {/* Import summary */}
      {importSummary && (
        <div className="rounded-2xl border border-warm-200/80 bg-white p-5">
          <div className="flex flex-wrap gap-2.5 text-sm">
            {importSummary.imported > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-forest-light px-3.5 py-1.5 font-medium text-forest ring-1 ring-forest/20">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                {importSummary.imported} importiert
              </span>
            )}
            {importSummary.skipped > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-warm-50 px-3.5 py-1.5 font-medium text-warm-600 ring-1 ring-warm-200/60">
                {importSummary.skipped} bereits vorhanden
              </span>
            )}
            {importSummary.failed > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-coral-light px-3.5 py-1.5 font-medium text-coral ring-1 ring-coral/20">
                {importSummary.failed} fehlgeschlagen
              </span>
            )}
          </div>

          <button
            onClick={handleReset}
            className="mt-4 rounded-xl bg-forest px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-forest-dark hover:shadow-md active:scale-[0.98]"
          >
            Weiteres Foto scannen
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Manual Tab ───

function ManualTab({ router }: { router: ReturnType<typeof useRouter> }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    minPlayers: 1,
    maxPlayers: 4,
    playingTime: 30,
    minAge: 0,
    averageWeight: 2.0,
    yearpublished: null as number | null,
    thumbnail: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;

    setSaving(true);
    try {
      const game = await createGame({
        ...form,
        thumbnail: form.thumbnail || null,
        owned: true,
      });
      router.push(`/game?id=${game.id}`);
    } catch {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-5 space-y-5 rounded-2xl border border-warm-200/80 bg-white p-5">
      <p className="text-sm text-warm-500">
        Spiel manuell anlegen – für Spiele die nicht auf BGG sind.
      </p>

      <FormField label="Name *">
        <input
          type="text"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="z.B. Catan"
          className="w-full rounded-xl border border-warm-200 bg-warm-50/50 px-3.5 py-2.5 text-sm text-warm-800 placeholder:text-warm-400 transition-colors focus:border-forest focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest/10"
        />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Min. Spieler">
          <input type="number" min={1} value={form.minPlayers} onChange={(e) => setForm({ ...form, minPlayers: Number(e.target.value) })} className="w-full rounded-xl border border-warm-200 bg-warm-50/50 px-3.5 py-2.5 text-sm text-warm-800 transition-colors focus:border-forest focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest/10" />
        </FormField>
        <FormField label="Max. Spieler">
          <input type="number" min={1} value={form.maxPlayers} onChange={(e) => setForm({ ...form, maxPlayers: Number(e.target.value) })} className="w-full rounded-xl border border-warm-200 bg-warm-50/50 px-3.5 py-2.5 text-sm text-warm-800 transition-colors focus:border-forest focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest/10" />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Spieldauer (Min)">
          <input type="number" min={1} value={form.playingTime} onChange={(e) => setForm({ ...form, playingTime: Number(e.target.value) })} className="w-full rounded-xl border border-warm-200 bg-warm-50/50 px-3.5 py-2.5 text-sm text-warm-800 transition-colors focus:border-forest focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest/10" />
        </FormField>
        <FormField label="Mindestalter">
          <input type="number" min={0} value={form.minAge} onChange={(e) => setForm({ ...form, minAge: Number(e.target.value) })} className="w-full rounded-xl border border-warm-200 bg-warm-50/50 px-3.5 py-2.5 text-sm text-warm-800 transition-colors focus:border-forest focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest/10" />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Komplexität (1–5)">
          <input type="number" min={1} max={5} step={0.1} value={form.averageWeight} onChange={(e) => setForm({ ...form, averageWeight: Number(e.target.value) })} className="w-full rounded-xl border border-warm-200 bg-warm-50/50 px-3.5 py-2.5 text-sm text-warm-800 transition-colors focus:border-forest focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest/10" />
        </FormField>
        <FormField label="Erscheinungsjahr">
          <input type="number" value={form.yearpublished ?? ""} onChange={(e) => setForm({ ...form, yearpublished: e.target.value ? Number(e.target.value) : null })} className="w-full rounded-xl border border-warm-200 bg-warm-50/50 px-3.5 py-2.5 text-sm text-warm-800 transition-colors focus:border-forest focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest/10" />
        </FormField>
      </div>

      <FormField label="Bild-URL (optional)">
        <input
          type="url"
          value={form.thumbnail}
          onChange={(e) => setForm({ ...form, thumbnail: e.target.value })}
          placeholder="https://..."
          className="w-full rounded-xl border border-warm-200 bg-warm-50/50 px-3.5 py-2.5 text-sm text-warm-800 placeholder:text-warm-400 transition-colors focus:border-forest focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest/10"
        />
      </FormField>

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-xl bg-forest px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-forest-dark hover:shadow-md disabled:opacity-50 active:scale-[0.98] sm:w-auto"
      >
        {saving ? "Wird gespeichert..." : "Spiel hinzufügen"}
      </button>
    </form>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-warm-500 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}
