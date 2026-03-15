"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { BggGameData, BggSearchResult } from "@/types/game";
import { createGame, getGameByBggId } from "@/lib/db-client";
import { searchBgg as bggSearch, fetchBggThing, fetchBggCollection, isBggConfigured } from "@/services/bgg-client";

type ActiveTab = "bgg-search" | "bgg-collection" | "bgg-bulk" | "manual";

export default function AddGamePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>("bgg-search");

  return (
    <div>
      <h1 className="font-display text-3xl font-bold tracking-tight text-warm-900">Spiel hinzufügen</h1>
      <p className="mt-1 text-sm font-medium text-warm-500">Erweitere deine Sammlung</p>

      {/* Tabs */}
      <div className="mt-5 flex gap-1 rounded-2xl bg-warm-100 p-1">
        <TabButton active={activeTab === "bgg-search"} onClick={() => setActiveTab("bgg-search")}>
          BGG Suche
        </TabButton>
        <TabButton active={activeTab === "bgg-collection"} onClick={() => setActiveTab("bgg-collection")}>
          Sammlung importieren
        </TabButton>
        <TabButton active={activeTab === "bgg-bulk"} onClick={() => setActiveTab("bgg-bulk")}>
          IDs importieren
        </TabButton>
        <TabButton active={activeTab === "manual"} onClick={() => setActiveTab("manual")}>
          Manuell
        </TabButton>
      </div>

      {activeTab === "bgg-search" && <BggSearchTab router={router} />}
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
            Seit Juli 2025 erfordert BoardGameGeek einen API-Token. So richtest du ihn ein:
          </p>
          <ol className="mt-2.5 list-decimal list-inside space-y-1.5 text-sm text-warm-600">
            <li>Gehe zu <a href="https://boardgamegeek.com/using_the_xml_api" target="_blank" rel="noopener noreferrer" className="underline font-medium text-forest hover:text-forest-dark">boardgamegeek.com/using_the_xml_api</a></li>
            <li>Registriere deine App und erstelle einen Token</li>
            <li>Erstelle eine Datei <code className="rounded-lg bg-warm-100 px-1.5 py-0.5 text-xs font-mono text-warm-700">.env.local</code> im Projektordner</li>
            <li>Füge ein: <code className="rounded-lg bg-warm-100 px-1.5 py-0.5 text-xs font-mono text-warm-700">BGG_API_TOKEN=dein_token</code></li>
            <li>Starte den Dev-Server neu</li>
          </ol>
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
