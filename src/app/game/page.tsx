"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Game } from "@/types/game";
import { PREDEFINED_TAGS, COMMON_MECHANICS } from "@/types/game";
import { getGameById, updateGame, createPlaySession, getSessionsByGame, getAllPlayers, getActiveLoanByGame, createLoan, returnLoan, getExpansionsByGame, createExpansion, updateExpansion, deleteExpansion } from "@/lib/db-client";
import { generateQuickRules, isAiConfigured, generateSaleText } from "@/services/ai-client";
import type { SaleCondition, SaleExtra, SaleTextResult } from "@/services/ai-client";
import { saveQuickRules, getQuickRules } from "@/lib/db-client";
import { COMMON_MECHANICS as AI_MECHANICS } from "@/types/game";
import RegelGuru from "@/components/RegelGuru";
import type { Player, PlaySession, Loan, AchievementKey, Expansion, BggSearchResult } from "@/types/game";
import { searchExpansions, searchExpansionsByName } from "@/services/bgg-client";
import { checkOnPlaySession } from "@/services/achievements";
import AchievementToast from "@/components/AchievementToast";

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
  const [activeLoan, setActiveLoan] = useState<Loan | null>(null);
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [loanName, setLoanName] = useState("");
  const [loanDate, setLoanDate] = useState(new Date().toISOString().split("T")[0]);
  const [achievementQueue, setAchievementQueue] = useState<AchievementKey[]>([]);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [saleCondition, setSaleCondition] = useState<SaleCondition>("Gut");
  const [saleExtras, setSaleExtras] = useState<SaleExtra[]>([]);
  const [saleResult, setSaleResult] = useState<SaleTextResult | null>(null);
  const [saleLoading, setSaleLoading] = useState(false);
  const [saleError, setSaleError] = useState<string | null>(null);
  const [saleToast, setSaleToast] = useState<string | null>(null);
  const [expansions, setExpansions] = useState<Expansion[]>([]);
  const [showExpansionSearch, setShowExpansionSearch] = useState(false);
  const [expansionSearchResults, setExpansionSearchResults] = useState<BggSearchResult[]>([]);
  const [expansionSearchLoading, setExpansionSearchLoading] = useState(false);
  const [expansionManualName, setExpansionManualName] = useState("");

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    Promise.all([
      getGameById(id),
      getSessionsByGame(id),
      getAllPlayers(),
      isAiConfigured(),
      getActiveLoanByGame(id),
      getExpansionsByGame(id),
    ])
      .then(([data, sess, pl, aiOk, loan, exps]) => {
        setGame(data ?? null);
        setSessions(sess);
        setPlayers(pl);
        setAiAvailable(aiOk);
        setActiveLoan(loan ?? null);
        setExpansions(exps);
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

  async function handleLendGame() {
    if (!game || !loanName.trim()) return;
    setSaving(true);
    const loan = await createLoan({
      gameId: game.id,
      personName: loanName.trim(),
      loanDate,
    });
    setActiveLoan(loan);
    setShowLoanForm(false);
    setLoanName("");
    setSaving(false);
  }

  async function handleReturnGame() {
    if (!activeLoan) return;
    setSaving(true);
    await returnLoan(activeLoan.id);
    setActiveLoan(null);
    setSaving(false);
  }

  function loanDaysOut(loan: Loan): number {
    const ms = Date.now() - new Date(loan.loanDate).getTime();
    return Math.floor(ms / (1000 * 60 * 60 * 24));
  }

  async function openQuickRules() {
    if (!game) return;
    setShowQuickRules(true);
    setQuickRulesError(null);
    if (quickRulesText) return; // already loaded in state
    
    // Check if we have cached rules in DB
    const cached = await getQuickRules(game.id);
    if (cached) {
      setQuickRulesText(cached);
      return;
    }
    
    setQuickRulesLoading(true);
    try {
      const mechanicLabels = game.mechanics.map((m) => {
        const known = AI_MECHANICS.find((k) => k.value === m);
        return known ? known.label : m;
      });
      const text = await generateQuickRules(game.name, mechanicLabels);
      setQuickRulesText(text);
      // Save to DB for next time
      await saveQuickRules(game.id, text);
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

  async function toggleForSale() {
    if (!game) return;
    setSaving(true);
    const updated = await updateGame(game.id, { forSale: !game.forSale });
    if (updated) setGame(updated);
    setSaving(false);
  }

  async function handleGenerateSaleText() {
    if (!game) return;
    setSaleLoading(true);
    setSaleError(null);
    setSaleResult(null);
    try {
      const playerCount = game.minPlayers === game.maxPlayers
        ? `${game.minPlayers}`
        : `${game.minPlayers}–${game.maxPlayers}`;
      const result = await generateSaleText(game.name, saleCondition, saleExtras, playerCount, game.playingTime);
      setSaleResult(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
      if (msg === "AI_NOT_CONFIGURED") {
        setSaleError("AI ist nicht konfiguriert. Bitte richte in den Einstellungen einen AI-Provider ein.");
      } else if (msg === "AI_RATE_LIMIT") {
        setSaleError("Zu viele Anfragen. Bitte versuche es in einer Minute erneut.");
      } else {
        setSaleError("Verkaufstext konnte nicht generiert werden. Bitte versuche es erneut.");
      }
    } finally {
      setSaleLoading(false);
    }
  }

  async function copySaleText() {
    if (!saleResult) return;
    const fullText = `${saleResult.text}\n\nPreisvorschlag: ca. ${saleResult.suggestedPrice} €`;
    try {
      await navigator.clipboard.writeText(fullText);
      setSaleToast("Kopiert! Jetzt bei Kleinanzeigen einfügen 📋");
      setTimeout(() => setSaleToast(null), 3000);
    } catch {
      setSaleToast("Kopieren fehlgeschlagen");
      setTimeout(() => setSaleToast(null), 3000);
    }
  }

  async function shareSaleText() {
    if (!saleResult || !game) return;
    const fullText = `${saleResult.text}\n\nPreisvorschlag: ca. ${saleResult.suggestedPrice} €`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${game.name} zu verkaufen`, text: fullText });
      } catch {
        // User cancelled share
      }
    }
  }

  async function handleSearchExpansions() {
    if (!game?.bggId) return;
    setShowExpansionSearch(true);
    setExpansionSearchLoading(true);
    setExpansionSearchResults([]);
    try {
      let results = await searchExpansions(game.bggId);
      if (results.length === 0) {
        results = await searchExpansionsByName(game.name);
      }
      // Filter out already-added expansions
      const existingBggIds = new Set(expansions.map((e) => e.bggId).filter(Boolean));
      setExpansionSearchResults(results.filter((r) => !existingBggIds.has(r.bggId)));
    } catch {
      setExpansionSearchResults([]);
    } finally {
      setExpansionSearchLoading(false);
    }
  }

  async function handleAddExpansionFromBgg(result: BggSearchResult) {
    if (!game) return;
    const exp = await createExpansion({
      parentGameId: game.id,
      bggId: result.bggId,
      name: result.name,
      owned: false,
    });
    setExpansions((prev) => [...prev, exp]);
    setExpansionSearchResults((prev) => prev.filter((r) => r.bggId !== result.bggId));
  }

  async function handleAddExpansionManual() {
    if (!game || !expansionManualName.trim()) return;
    const exp = await createExpansion({
      parentGameId: game.id,
      name: expansionManualName.trim(),
      owned: false,
    });
    setExpansions((prev) => [...prev, exp]);
    setExpansionManualName("");
  }

  async function handleToggleExpansionOwned(exp: Expansion) {
    const updated = await updateExpansion(exp.id, { owned: !exp.owned });
    if (updated) {
      setExpansions((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    }
  }

  async function handleDeleteExpansion(id: number) {
    await deleteExpansion(id);
    setExpansions((prev) => prev.filter((e) => e.id !== id));
  }

  function toggleSaleExtra(extra: SaleExtra) {
    setSaleExtras((prev) =>
      prev.includes(extra) ? prev.filter((e) => e !== extra) : [...prev, extra]
    );
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
            {aiAvailable && (
              <button
                onClick={() => setShowSaleModal(true)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition-all hover:shadow-md active:scale-[0.98] ${
                  game.forSale
                    ? "bg-amber-light text-amber-dark"
                    : "bg-warm-100 text-warm-600 hover:bg-warm-200 shadow-none"
                }`}
              >
                💰 Verkaufen
              </button>
            )}
            {game.lastPlayed && (
              <span className="inline-flex items-center rounded-xl bg-warm-50 px-3.5 py-2 text-sm text-warm-500 ring-1 ring-warm-200/60">
                Zuletzt: {new Date(game.lastPlayed).toLocaleDateString("de-DE")}
              </span>
            )}
          </div>

          {/* Erweiterungen */}
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-warm-500 uppercase tracking-wider">
                Erweiterungen {expansions.length > 0 && `(${expansions.filter((e) => e.owned).length}/${expansions.length})`}
              </h3>
              <button
                onClick={game.bggId ? handleSearchExpansions : () => setShowExpansionSearch(true)}
                className="text-xs font-medium text-forest hover:text-forest-dark transition-colors"
              >
                + Hinzufügen
              </button>
            </div>

            {expansions.length > 0 && (
              <div className="mt-2.5 space-y-1.5">
                {expansions.map((exp) => (
                  <div key={exp.id} className={`flex items-center gap-2.5 rounded-xl px-3 py-2 ${exp.owned ? "bg-forest-light" : "bg-warm-50 ring-1 ring-warm-200/60"}`}>
                    <button
                      onClick={() => handleToggleExpansionOwned(exp)}
                      className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                        exp.owned
                          ? "border-forest bg-forest text-white"
                          : "border-warm-300 bg-white hover:border-warm-400"
                      }`}
                      aria-label={exp.owned ? "Als nicht besessen markieren" : "Als besessen markieren"}
                    >
                      {exp.owned && (
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                    <span className={`flex-1 text-sm ${exp.owned ? "text-forest font-medium" : "text-warm-600"}`}>
                      {exp.name}
                    </span>
                    <button
                      onClick={() => handleDeleteExpansion(exp.id)}
                      className="flex-shrink-0 text-warm-400 hover:text-red-500 transition-colors"
                      aria-label={`${exp.name} entfernen`}
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                {expansions.some((e) => !e.owned) && (
                  <p className="mt-1 text-[11px] text-warm-400 italic">
                    Nicht angehakte = Wunschliste
                  </p>
                )}
              </div>
            )}

            {/* Expansion Search Modal */}
            {showExpansionSearch && (
              <div className="mt-3 rounded-2xl border border-warm-200/80 bg-surface p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-warm-900">Erweiterung hinzufügen</h4>
                  <button
                    onClick={() => { setShowExpansionSearch(false); setExpansionSearchResults([]); setExpansionManualName(""); }}
                    className="text-warm-400 hover:text-warm-600"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {expansionSearchLoading && (
                  <div className="flex items-center gap-2 py-4 justify-center">
                    <div className="spinner" />
                    <span className="text-sm text-warm-500">Suche Erweiterungen...</span>
                  </div>
                )}

                {!expansionSearchLoading && expansionSearchResults.length > 0 && (
                  <div className="max-h-48 overflow-y-auto space-y-1 mb-3">
                    {expansionSearchResults.map((r) => (
                      <button
                        key={r.bggId}
                        onClick={() => handleAddExpansionFromBgg(r)}
                        className="w-full text-left rounded-xl px-3 py-2 text-sm text-warm-700 hover:bg-warm-50 transition-colors"
                      >
                        {r.name}
                        {r.yearpublished && <span className="text-warm-400 ml-1">({r.yearpublished})</span>}
                      </button>
                    ))}
                  </div>
                )}

                {!expansionSearchLoading && expansionSearchResults.length === 0 && game.bggId && (
                  <p className="text-sm text-warm-500 mb-3">Keine Erweiterungen auf BGG gefunden.</p>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={expansionManualName}
                    onChange={(e) => setExpansionManualName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddExpansionManual(); }}
                    placeholder="Manuell hinzufügen..."
                    className="flex-1 rounded-xl border border-warm-200 bg-warm-50/50 px-3 py-2 text-sm text-warm-800 placeholder:text-warm-400 focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/10"
                  />
                  <button
                    onClick={handleAddExpansionManual}
                    disabled={!expansionManualName.trim()}
                    className="rounded-xl bg-forest px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-forest-dark active:scale-[0.98] disabled:opacity-50"
                  >
                    +
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Loan Status */}
          <div className="mt-6">
            {activeLoan ? (
              <div className={`rounded-2xl border p-4 ${loanDaysOut(activeLoan) >= 28 ? "border-coral/40 bg-coral-light" : "border-amber/40 bg-amber-light"}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-warm-900">
                      📦 Verliehen an {activeLoan.personName}
                    </p>
                    <p className="mt-0.5 text-xs text-warm-600">
                      Seit {new Date(activeLoan.loanDate).toLocaleDateString("de-DE")} ({loanDaysOut(activeLoan)} Tage)
                    </p>
                    {loanDaysOut(activeLoan) >= 28 && (
                      <p className="mt-1.5 text-xs font-semibold text-coral">
                        Erinnerung: Schon über 4 Wochen verliehen!
                      </p>
                    )}
                  </div>
                  <button
                    onClick={handleReturnGame}
                    disabled={saving}
                    className="rounded-xl bg-forest px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-forest-dark active:scale-[0.98]"
                  >
                    Zurückbekommen
                  </button>
                </div>
              </div>
            ) : showLoanForm ? (
              <div className="rounded-2xl border border-warm-200/80 bg-surface p-4">
                <h3 className="text-sm font-semibold text-warm-900 mb-3">Spiel verleihen</h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={loanName}
                    onChange={(e) => setLoanName(e.target.value)}
                    placeholder="Name der Person..."
                    className="w-full rounded-xl border border-warm-200 bg-warm-50/50 px-3.5 py-2.5 text-sm text-warm-800 placeholder:text-warm-400 focus:border-forest focus:bg-surface focus:outline-none focus:ring-2 focus:ring-forest/10"
                  />
                  <input
                    type="date"
                    value={loanDate}
                    onChange={(e) => setLoanDate(e.target.value)}
                    max={new Date().toISOString().split("T")[0]}
                    className="w-full rounded-xl border border-warm-200 bg-warm-50/50 px-3.5 py-2.5 text-sm text-warm-800 focus:border-forest focus:bg-surface focus:outline-none focus:ring-2 focus:ring-forest/10"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowLoanForm(false)}
                      className="flex-1 rounded-xl bg-warm-100 px-4 py-2.5 text-sm font-medium text-warm-600 transition-colors hover:bg-warm-200"
                    >
                      Abbrechen
                    </button>
                    <button
                      onClick={handleLendGame}
                      disabled={saving || !loanName.trim()}
                      className="flex-1 rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-forest-dark active:scale-[0.98] disabled:opacity-50"
                    >
                      Verleihen
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowLoanForm(true)}
                className="rounded-xl bg-warm-100 px-4 py-2 text-sm font-medium text-warm-600 transition-colors hover:bg-warm-200"
              >
                📦 Verleihen...
              </button>
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
            // Check achievements
            const newAchievements = await checkOnPlaySession(game.lastPlayed, game.mechanics);
            if (newAchievements.length > 0) {
              setAchievementQueue((prev) => [...prev, ...newAchievements]);
            }
          }}
        />
      )}

      {/* Quick Rules Modal (Bottom-Sheet style) */}
      {showQuickRules && game && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-warm-900/60 backdrop-blur-sm" onClick={() => setShowQuickRules(false)}>
          <div className="mx-0 w-full max-w-lg max-h-[80vh] flex flex-col rounded-t-2xl bg-surface shadow-2xl sm:mx-4 sm:mb-auto sm:mt-auto sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Sticky header with close button */}
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-warm-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🎲</span>
                <div>
                  <h2 className="font-display text-xl font-bold text-warm-900">Kurzregeln</h2>
                  <p className="text-sm text-warm-500">{game.name}</p>
                </div>
              </div>
              <button
                onClick={() => setShowQuickRules(false)}
                className="rounded-full p-2 text-warm-400 transition-colors hover:bg-warm-100 hover:text-warm-600"
                aria-label="Schließen"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto flex-1 px-6 py-4">
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

            {/* Sticky footer buttons */}
            <div className="px-6 pb-5 pt-3 border-t border-warm-100 flex-shrink-0 flex flex-col gap-2">
              <div className="flex gap-3">
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
              <div className="flex gap-3">
                {game.bggId && (
                  <a
                    href={`https://boardgamegeek.com/boardgame/${game.bggId}/files`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-warm-200 px-4 py-2 text-sm font-medium text-warm-600 transition-colors hover:bg-warm-50"
                  >
                    📄 BGG Anleitungen
                  </a>
                )}
                <a
                  href={`https://www.google.com/search?q=${encodeURIComponent(game.name + " Spielanleitung PDF")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-warm-200 px-4 py-2 text-sm font-medium text-warm-600 transition-colors hover:bg-warm-50"
                >
                  🔍 PDF suchen
                </a>
              </div>
              {quickRulesText && !quickRulesLoading && (
                <button
                  onClick={async () => {
                    if (!game) return;
                    setQuickRulesText(null);
                    setQuickRulesLoading(true);
                    setQuickRulesError(null);
                    try {
                      const mechanicLabels = game.mechanics.map((m) => {
                        const known = AI_MECHANICS.find((k) => k.value === m);
                        return known ? known.label : m;
                      });
                      const text = await generateQuickRules(game.name, mechanicLabels);
                      setQuickRulesText(text);
                      await saveQuickRules(game.id, text);
                    } catch {
                      setQuickRulesError("Regeln konnten nicht neu geladen werden.");
                    } finally {
                      setQuickRulesLoading(false);
                    }
                  }}
                  className="w-full rounded-xl border border-warm-200 px-4 py-2 text-sm text-warm-500 transition-colors hover:bg-warm-50"
                >
                  🔄 Neu generieren
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sale Modal */}
      {showSaleModal && game && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-warm-900/60 backdrop-blur-sm" onClick={() => setShowSaleModal(false)}>
          <div className="mx-0 w-full max-w-lg max-h-[85vh] flex flex-col rounded-t-2xl bg-surface shadow-2xl sm:mx-4 sm:mb-auto sm:mt-auto sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-warm-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-2xl">💰</span>
                <div>
                  <h2 className="font-display text-xl font-bold text-warm-900">Verkaufshelfer</h2>
                  <p className="text-sm text-warm-500">{game.name}</p>
                </div>
              </div>
              <button
                onClick={() => setShowSaleModal(false)}
                className="rounded-full p-2 text-warm-400 transition-colors hover:bg-warm-100 hover:text-warm-600"
                aria-label="Schließen"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
              {/* For Sale Toggle */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-warm-700">Als &quot;Zu verkaufen&quot; markieren</span>
                <button
                  onClick={toggleForSale}
                  disabled={saving}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                    game.forSale ? "bg-forest" : "bg-warm-300"
                  }`}
                  role="switch"
                  aria-checked={game.forSale}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    game.forSale ? "translate-x-6" : "translate-x-1"
                  }`} />
                </button>
              </div>

              {/* Condition */}
              <div>
                <label className="text-xs font-semibold text-warm-500 uppercase tracking-wider">Zustand</label>
                <select
                  value={saleCondition}
                  onChange={(e) => setSaleCondition(e.target.value as SaleCondition)}
                  className="mt-1.5 w-full rounded-xl border border-warm-200 bg-warm-50/50 px-3.5 py-2.5 text-sm text-warm-800 focus:border-forest focus:bg-surface focus:outline-none focus:ring-2 focus:ring-forest/10"
                >
                  <option value="Wie neu">Wie neu</option>
                  <option value="Gut">Gut</option>
                  <option value="Gebrauchsspuren">Gebrauchsspuren</option>
                  <option value="Stark bespielt">Stark bespielt</option>
                </select>
              </div>

              {/* Extras */}
              <div>
                <label className="text-xs font-semibold text-warm-500 uppercase tracking-wider">Extras</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(["OVP", "Sleeves", "Erweiterungen dabei", "Vollständig"] as SaleExtra[]).map((extra) => (
                    <button
                      key={extra}
                      onClick={() => toggleSaleExtra(extra)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                        saleExtras.includes(extra)
                          ? "bg-forest text-white shadow-sm"
                          : "bg-warm-50 text-warm-600 ring-1 ring-warm-200/60 hover:bg-warm-100"
                      }`}
                    >
                      {extra}
                    </button>
                  ))}
                </div>
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerateSaleText}
                disabled={saleLoading}
                className="w-full rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-forest-dark hover:shadow-md active:scale-[0.98] disabled:opacity-50"
              >
                {saleLoading ? "Wird generiert..." : "✨ Verkaufstext generieren"}
              </button>

              {/* Error */}
              {saleError && (
                <div className="rounded-xl bg-coral-light p-4 text-sm text-coral">
                  {saleError}
                </div>
              )}

              {/* Result */}
              {saleResult && (
                <div className="space-y-3">
                  <div className="rounded-xl bg-warm-50 p-4 ring-1 ring-warm-200/60">
                    <p className="text-sm leading-relaxed text-warm-800 whitespace-pre-line">{saleResult.text}</p>
                  </div>
                  <div className="rounded-xl bg-forest-light p-4 text-center">
                    <p className="text-xs font-semibold text-forest uppercase tracking-wider">Preisvorschlag</p>
                    <p className="mt-1 font-display text-2xl font-bold text-forest">ca. {saleResult.suggestedPrice} €</p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={copySaleText}
                      className="flex-1 rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-forest-dark hover:shadow-md active:scale-[0.98]"
                    >
                      📋 Text kopieren
                    </button>
                    {"share" in navigator && (
                      <button
                        onClick={shareSaleText}
                        className="flex-1 rounded-xl bg-warm-100 px-4 py-2.5 text-sm font-medium text-warm-600 transition-colors hover:bg-warm-200"
                      >
                        Teilen
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 pb-5 pt-3 border-t border-warm-100 flex-shrink-0">
              <button
                onClick={() => setShowSaleModal(false)}
                className="w-full rounded-xl bg-warm-100 px-4 py-2.5 text-sm font-medium text-warm-600 transition-colors hover:bg-warm-200"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sale Toast */}
      {saleToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] rounded-xl bg-invert px-5 py-2.5 text-sm font-medium text-invert-text shadow-xl transition-all">
          {saleToast}
        </div>
      )}

      {saving && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 rounded-xl bg-invert px-5 py-2.5 text-sm font-medium text-invert-text shadow-xl sm:bottom-6">
          Wird gespeichert...
        </div>
      )}

      {achievementQueue.length > 0 && (
        <AchievementToast
          achievementKey={achievementQueue[0]}
          onDone={() => setAchievementQueue((prev) => prev.slice(1))}
        />
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
