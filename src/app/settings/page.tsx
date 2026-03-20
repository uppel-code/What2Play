"use client";

import { useState, useEffect, useRef } from "react";
import { getBggToken, setBggToken, isBggConfigured, testBggConnection } from "@/services/bgg-client";
import type { BggTestResult } from "@/services/bgg-client";
import { getAiConfig, setAiConfig, clearAiConfig, isAiConfigured, getGameLanguage, setGameLanguage, testAiConnection, getUseNativeHttp, setUseNativeHttp } from "@/services/ai-client";
import type { AiProvider, GameLanguage, AiTestResult } from "@/services/ai-client";
import { getGameCount, getAllGamesRaw, getAllPlayersRaw, getAllPlayGroupsRaw, getAllSessionsRaw, getAllLoansRaw, clearAllData, bulkImportData } from "@/lib/db-client";
import { useTheme } from "@/components/ThemeProvider";
import type { ThemeMode } from "@/services/theme";
import { createBackup, downloadBackup, readFileAsText, parseBackup, getBackupPreview, type BackupData, type BackupPreview } from "@/services/backup";
import { Preferences } from "@capacitor/preferences";
import { getNotificationsEnabled, setNotificationsEnabled } from "@/services/notification-service";

export default function SettingsPage() {
  const { mode: themeMode, setMode: setThemeMode } = useTheme();
  const [token, setToken] = useState("");
  const [savedToken, setSavedToken] = useState<string | null>(null);
  const [bggConfigured, setBggConfigured] = useState<boolean | null>(null);
  const [bggSaving, setBggSaving] = useState(false);
  const [bggSaved, setBggSaved] = useState(false);
  const [bggTesting, setBggTesting] = useState(false);
  const [bggTestResult, setBggTestResult] = useState<BggTestResult | null>(null);

  const [aiProvider, setAiProvider] = useState<AiProvider>("gemini");
  const [aiKey, setAiKey] = useState("");
  const [savedAiKey, setSavedAiKey] = useState<string | null>(null);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiSaved, setAiSaved] = useState(false);

  const [aiTesting, setAiTesting] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<AiTestResult | null>(null);
  const [aiTestError, setAiTestError] = useState<string | null>(null);
  const [useNativeHttp, setUseNativeHttpState] = useState(false);

  const [gameCount, setGameCount] = useState<number>(0);

  const [gameLanguage, setGameLang] = useState<GameLanguage>("de");
  const [langSaved, setLangSaved] = useState(false);

  // Export/Import state
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const [importPreview, setImportPreview] = useState<BackupPreview | null>(null);
  const [importData, setImportData] = useState<BackupData | null>(null);
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [notificationsOn, setNotificationsOn] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      const t = await getBggToken();
      setSavedToken(t);
      if (t) setToken(t);
      setBggConfigured(await isBggConfigured());
      setGameCount(await getGameCount());

      const ac = await getAiConfig();
      if (ac) {
        setAiProvider(ac.provider);
        setAiKey(ac.apiKey);
        setSavedAiKey(ac.apiKey);
      }
      setAiConfigured(await isAiConfigured());
      setUseNativeHttpState(await getUseNativeHttp());
      setGameLang(await getGameLanguage());
      setNotificationsOn(await getNotificationsEnabled());
    }
    load();
  }, []);

  async function handleSaveBggToken() {
    if (!token.trim()) return;
    setBggSaving(true);
    try {
      await setBggToken(token.trim());
      setSavedToken(token.trim());
      setBggConfigured(true);
      setBggSaved(true);
      setTimeout(() => setBggSaved(false), 3000);
    } finally {
      setBggSaving(false);
    }
  }

  async function handleClearBggToken() {
    await setBggToken("");
    setToken("");
    setSavedToken(null);
    setBggConfigured(false);
    setBggTestResult(null);
  }

  async function handleTestBgg() {
    setBggTesting(true);
    setBggTestResult(null);
    try {
      const result = await testBggConnection();
      setBggTestResult(result);
    } finally {
      setBggTesting(false);
    }
  }

  async function handleSaveAiConfig() {
    if (!aiKey.trim()) return;
    setAiSaving(true);
    try {
      await setAiConfig(aiProvider, aiKey.trim());
      setSavedAiKey(aiKey.trim());
      setAiConfigured(true);
      setAiSaved(true);
      setTimeout(() => setAiSaved(false), 3000);
    } finally {
      setAiSaving(false);
    }
  }

  async function handleClearAiConfig() {
    await clearAiConfig();
    setAiKey("");
    setSavedAiKey(null);
    setAiConfigured(false);
  }

  async function handleTestAi() {
    setAiTesting(true);
    setAiTestResult(null);
    setAiTestError(null);
    try {
      const result = await testAiConnection();
      setAiTestResult(result);
    } catch (err) {
      setAiTestError(err instanceof Error ? err.message : String(err));
    } finally {
      setAiTesting(false);
    }
  }

  async function handleNativeHttpToggle() {
    const next = !useNativeHttp;
    setUseNativeHttpState(next);
    await setUseNativeHttp(next);
  }

  const providerLabels: Record<AiProvider, string> = {
    gemini: "Google Gemini",
    openai: "OpenAI",
    claude: "Anthropic Claude",
  };

  async function handleExport() {
    setExporting(true);
    setExportDone(false);
    try {
      const [games, players, playGroups, sessions, loans] = await Promise.all([
        getAllGamesRaw(),
        getAllPlayersRaw(),
        getAllPlayGroupsRaw(),
        getAllSessionsRaw(),
        getAllLoansRaw(),
      ]);
      const backup = await createBackup(games, players, playGroups, sessions, loans);
      downloadBackup(backup);
      setExportDone(true);
      setTimeout(() => setExportDone(false), 3000);
    } finally {
      setExporting(false);
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    setImportDone(null);
    try {
      const text = await readFileAsText(file);
      const data = parseBackup(text);
      setImportData(data);
      setImportPreview(getBackupPreview(data));
      setImportMode("merge");
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Unbekannter Fehler beim Lesen der Datei.");
      setImportData(null);
      setImportPreview(null);
    }
    // Reset file input so the same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleImport() {
    if (!importData) return;
    setImporting(true);
    setImportError(null);
    try {
      if (importMode === "replace") {
        await clearAllData();
      }
      await bulkImportData(
        importData.games,
        importData.players,
        importData.playGroups,
        importData.playSessions,
        importData.loans ?? []
      );
      // Restore settings
      if (importData.settings) {
        if (importData.settings.language) {
          await Preferences.set({ key: "game_language", value: importData.settings.language });
          setGameLang(importData.settings.language as GameLanguage);
        }
        if (importData.settings.theme) {
          await Preferences.set({ key: "theme_mode", value: importData.settings.theme });
          setThemeMode(importData.settings.theme as ThemeMode);
        }
      }
      const count = importData.games.length;
      const sessionCount = importData.playSessions.length;
      setImportDone(`${count} Spiele und ${sessionCount} Sessions importiert!`);
      setImportData(null);
      setImportPreview(null);
      // Refresh game count
      setGameCount(await getGameCount());
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Fehler beim Import.");
    } finally {
      setImporting(false);
    }
  }

  function cancelImport() {
    setImportData(null);
    setImportPreview(null);
    setImportError(null);
  }

  async function handleLanguageChange(lang: GameLanguage) {
    setGameLang(lang);
    await setGameLanguage(lang);
    setLangSaved(true);
    setTimeout(() => setLangSaved(false), 2000);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-warm-900">Einstellungen</h1>
        <p className="mt-1 text-sm font-medium text-warm-500">App-Konfiguration</p>
      </div>

      {/* BGG API Token */}
      <div className="rounded-2xl border border-warm-200/80 bg-surface p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${bggConfigured ? "bg-forest-light" : "bg-amber-light"}`}>
            <svg className={`h-5 w-5 ${bggConfigured ? "text-forest" : "text-amber-dark"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-warm-900">BGG API-Token</h2>
            <p className="text-sm text-warm-500">
              {bggConfigured
                ? "Verbunden — BGG-Suche und Import funktionieren."
                : "Nicht konfiguriert — BGG-Features sind deaktiviert."}
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-warm-50 p-4 mb-4">
          <p className="text-sm text-warm-600 leading-relaxed">
            Die App wird mit einem Standard-Token ausgeliefert und funktioniert sofort.
            Falls du einen eigenen Token verwenden möchtest, kannst du ihn hier ändern.
          </p>
        </div>

        <div className="space-y-3">
          <label className="block text-xs font-semibold text-warm-500 uppercase tracking-wider">API-Token</label>
          <div className="flex gap-2">
            <input
              type="password"
              value={token}
              onChange={(e) => { setToken(e.target.value); setBggSaved(false); }}
              placeholder="Dein BGG API-Token einfügen..."
              className="flex-1 rounded-xl border border-warm-200 bg-warm-50/50 px-3.5 py-2.5 text-sm font-mono text-warm-800 placeholder:text-warm-400 transition-colors focus:border-forest focus:bg-surface focus:outline-none focus:ring-2 focus:ring-forest/10"
            />
            <button
              onClick={handleSaveBggToken}
              disabled={bggSaving || !token.trim() || token.trim() === savedToken}
              className="rounded-xl bg-forest px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-forest-dark hover:shadow-md disabled:opacity-50 active:scale-[0.98]"
            >
              {bggSaving ? "Speichern..." : "Speichern"}
            </button>
          </div>

          {bggSaved && (
            <div className="flex items-center gap-2 rounded-xl bg-forest-light px-4 py-2.5 text-sm font-medium text-forest">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Token gespeichert!
            </div>
          )}

          {savedToken && !bggSaved && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleClearBggToken}
                className="text-sm text-coral hover:text-coral-dark font-medium transition-colors"
              >
                Token entfernen
              </button>
              <button
                onClick={handleTestBgg}
                disabled={bggTesting}
                className="rounded-xl border border-forest px-4 py-2 text-sm font-semibold text-forest transition-all hover:bg-forest-light disabled:opacity-50 active:scale-[0.98]"
              >
                {bggTesting ? "Teste..." : "BGG Token testen"}
              </button>
            </div>
          )}

          {bggTestResult && (
            <div className={`rounded-xl p-4 text-sm ${bggTestResult.success ? "bg-forest-light" : "bg-coral/10"}`}>
              <span className={`font-semibold ${bggTestResult.success ? "text-forest" : "text-coral"}`}>
                {bggTestResult.success ? "Verbindung OK!" : `Fehler (Status ${bggTestResult.status})`}
              </span>
              <span className="ml-2 text-warm-600">{bggTestResult.message}</span>
            </div>
          )}
        </div>
      </div>

      {/* AI Provider for Photo Scan */}
      <div className="rounded-2xl border border-warm-200/80 bg-surface p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${aiConfigured ? "bg-forest-light" : "bg-amber-light"}`}>
            <svg className={`h-5 w-5 ${aiConfigured ? "text-forest" : "text-amber-dark"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-warm-900">Foto-Scan (AI)</h2>
            <p className="text-sm text-warm-500">
              {aiConfigured
                ? `${providerLabels[aiProvider]} verbunden — Foto-Scan funktioniert.`
                : "Nicht konfiguriert — richte einen AI-Provider ein."}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {/* Provider auswahl ZUERST */}
          <div>
            <label className="block text-xs font-semibold text-warm-500 uppercase tracking-wider mb-1.5">AI-Provider</label>
            <div className="flex gap-1.5 rounded-xl bg-warm-100 p-1">
              {(["gemini", "openai", "claude"] as AiProvider[]).map((p) => (
                <button
                  key={p}
                  onClick={() => { setAiProvider(p); setAiSaved(false); }}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                    aiProvider === p
                      ? "bg-surface text-warm-900 shadow-sm"
                      : "text-warm-500 hover:text-warm-700"
                  }`}
                >
                  {providerLabels[p]}
                </button>
              ))}
            </div>
          </div>

          {/* Dynamischer Hilfe-Text basierend auf Provider */}
          <div className="rounded-xl bg-warm-50 p-4">
            <p className="text-sm text-warm-600 leading-relaxed">
              {aiProvider === "gemini" && (
                <>Für den Foto-Scan brauchst du einen AI-API-Key. <strong>Google Gemini</strong> ist empfohlen — der API-Key ist kostenlos (keine Kreditkarte nötig).</>
              )}
              {aiProvider === "openai" && (
                <>Für OpenAI brauchst du einen API-Key von der OpenAI Platform. <strong>Achtung:</strong> OpenAI ist kostenpflichtig (ca. $0.01 pro Foto-Scan).</>
              )}
              {aiProvider === "claude" && (
                <>Für Claude brauchst du einen API-Key von Anthropic. <strong>Achtung:</strong> Claude ist kostenpflichtig (ca. $0.01 pro Foto-Scan).</>
              )}
            </p>
            <a
              href={
                aiProvider === "gemini" ? "https://aistudio.google.com/apikey" :
                aiProvider === "openai" ? "https://platform.openai.com/api-keys" :
                "https://console.anthropic.com/settings/keys"
              }
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-forest hover:text-forest-dark transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              {aiProvider === "gemini" && "Kostenlosen Gemini API-Key erstellen →"}
              {aiProvider === "openai" && "OpenAI API-Key erstellen →"}
              {aiProvider === "claude" && "Anthropic API-Key erstellen →"}
            </a>
          </div>

          <div>
            <label className="block text-xs font-semibold text-warm-500 uppercase tracking-wider mb-1.5">API-Key</label>
            <div className="flex gap-2">
              <input
                type="password"
                value={aiKey}
                onChange={(e) => { setAiKey(e.target.value); setAiSaved(false); }}
                placeholder={
                  aiProvider === "gemini" ? "AIza... (Google AI Studio Key)" :
                  aiProvider === "openai" ? "sk-... (OpenAI Key)" :
                  "sk-ant-... (Anthropic Key)"
                }
                className="flex-1 rounded-xl border border-warm-200 bg-warm-50/50 px-3.5 py-2.5 text-sm font-mono text-warm-800 placeholder:text-warm-400 transition-colors focus:border-forest focus:bg-surface focus:outline-none focus:ring-2 focus:ring-forest/10"
              />
              <button
                onClick={handleSaveAiConfig}
                disabled={aiSaving || !aiKey.trim() || (aiKey.trim() === savedAiKey && aiProvider === (aiConfigured ? aiProvider : "gemini"))}
                className="rounded-xl bg-forest px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-forest-dark hover:shadow-md disabled:opacity-50 active:scale-[0.98]"
              >
                {aiSaving ? "Speichern..." : "Speichern"}
              </button>
            </div>
          </div>

          {aiSaved && (
            <div className="flex items-center gap-2 rounded-xl bg-forest-light px-4 py-2.5 text-sm font-medium text-forest">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              AI-Provider gespeichert! Foto-Scan ist jetzt aktiv.
            </div>
          )}

          {savedAiKey && !aiSaved && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleClearAiConfig}
                className="text-sm text-coral hover:text-coral-dark font-medium transition-colors"
              >
                AI-Konfiguration entfernen
              </button>
              <button
                onClick={handleTestAi}
                disabled={aiTesting || !aiConfigured}
                className="rounded-xl border border-forest px-4 py-2 text-sm font-semibold text-forest transition-all hover:bg-forest-light disabled:opacity-50 active:scale-[0.98]"
              >
                {aiTesting ? "Teste..." : "API-Key testen"}
              </button>
            </div>
          )}

          {/* API Test Result */}
          {aiTestResult && (
            <div className={`rounded-xl p-4 text-sm ${aiTestResult.success ? "bg-forest-light" : "bg-coral/10"}`}>
              <div className={`font-semibold mb-2 ${aiTestResult.success ? "text-forest" : "text-coral"}`}>
                {aiTestResult.success ? "API funktioniert!" : `Fehler (Status ${aiTestResult.status})`}
              </div>
              <div className="text-xs text-warm-500 mb-1">Methode: {aiTestResult.method}</div>
              <pre className="text-xs text-warm-700 whitespace-pre-wrap break-all max-h-48 overflow-y-auto bg-warm-50 rounded-lg p-3 border border-warm-200">
                {aiTestResult.responseText}
              </pre>
            </div>
          )}

          {/* API Test Error */}
          {aiTestError && (
            <div className="rounded-xl bg-coral/10 p-4 text-sm">
              <div className="font-semibold text-coral mb-2">Test fehlgeschlagen</div>
              <pre className="text-xs text-warm-700 whitespace-pre-wrap break-all bg-warm-50 rounded-lg p-3 border border-warm-200">
                {aiTestError}
              </pre>
            </div>
          )}

          {/* Native HTTP Toggle */}
          <div className="flex items-center justify-between rounded-xl bg-warm-50 p-4">
            <div>
              <div className="text-sm font-medium text-warm-700">Nativen HTTP-Client nutzen</div>
              <div className="text-xs text-warm-500 mt-0.5">
                Standard: fetch() (funktioniert überall). Native: CapacitorHttp (umgeht CORS).
              </div>
            </div>
            <button
              onClick={handleNativeHttpToggle}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                useNativeHttp ? "bg-forest" : "bg-warm-300"
              }`}
              role="switch"
              aria-checked={useNativeHttp}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                useNativeHttp ? "translate-x-6" : "translate-x-1"
              }`} />
            </button>
          </div>
        </div>
      </div>

      {/* Game Language */}
      <div className="rounded-2xl border border-warm-200/80 bg-surface p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest-light">
            <svg className="h-5 w-5 text-forest" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-warm-900">Spielenamen-Sprache</h2>
            <p className="text-sm text-warm-500">
              Bevorzugte Sprache für Spielenamen beim Import
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-warm-50 p-4 mb-4">
          <p className="text-sm text-warm-600 leading-relaxed">
            Viele Spiele haben unterschiedliche Namen auf Deutsch und Englisch
            (z.B. &quot;Flügelschlag&quot; vs &quot;Wingspan&quot;). Die AI wird versuchen,
            den Namen in deiner bevorzugten Sprache zu verwenden.
          </p>
        </div>

        <div className="flex gap-1.5 rounded-xl bg-warm-100 p-1">
          <button
            onClick={() => handleLanguageChange("de")}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
              gameLanguage === "de"
                ? "bg-surface text-warm-900 shadow-sm"
                : "text-warm-500 hover:text-warm-700"
            }`}
          >
            🇩🇪 Deutsch
          </button>
          <button
            onClick={() => handleLanguageChange("en")}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
              gameLanguage === "en"
                ? "bg-surface text-warm-900 shadow-sm"
                : "text-warm-500 hover:text-warm-700"
            }`}
          >
            🇬🇧 English
          </button>
        </div>

        {langSaved && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-forest-light px-4 py-2.5 text-sm font-medium text-forest">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Sprache gespeichert!
          </div>
        )}
      </div>

      {/* Benachrichtigungen */}
      <div className="rounded-2xl border border-warm-200/80 bg-surface p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${notificationsOn ? "bg-forest-light" : "bg-warm-100"}`}>
            <svg className={`h-5 w-5 ${notificationsOn ? "text-forest" : "text-warm-500"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <div className="flex-1">
            <h2 className="font-display text-lg font-bold text-warm-900">Benachrichtigungen</h2>
            <p className="text-sm text-warm-500">
              {notificationsOn
                ? "Erinnerungen sind aktiv"
                : "Push-Benachrichtigungen deaktiviert"}
            </p>
          </div>
          <button
            onClick={async () => {
              const next = !notificationsOn;
              setNotificationsOn(next);
              await setNotificationsEnabled(next);
            }}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
              notificationsOn ? "bg-forest" : "bg-warm-300"
            }`}
            role="switch"
            aria-checked={notificationsOn}
            data-testid="notifications-toggle"
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              notificationsOn ? "translate-x-6" : "translate-x-1"
            }`} />
          </button>
        </div>

        {notificationsOn && (
          <div className="rounded-xl bg-warm-50 p-4 text-sm text-warm-600 leading-relaxed dark:bg-warm-800 dark:text-warm-400">
            <p className="font-medium text-warm-700 dark:text-warm-300 mb-1">Du wirst erinnert an:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Spiele, die du seit 3 Monaten nicht gespielt hast</li>
              <li>Spieleabende am nächsten Tag</li>
              <li>Verliehene Spiele nach 4 Wochen</li>
              <li>Neue Achievements</li>
            </ul>
          </div>
        )}
      </div>

      {/* Dark Mode */}
      <div className="rounded-2xl border border-warm-200/80 bg-surface p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest-light">
            <svg className="h-5 w-5 text-forest" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-warm-900">Erscheinungsbild</h2>
            <p className="text-sm text-warm-500">
              Wähle zwischen hellem und dunklem Design
            </p>
          </div>
        </div>

        <div className="flex gap-1.5 rounded-xl bg-warm-100 p-1">
          {(["light", "system", "dark"] as ThemeMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setThemeMode(m)}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                themeMode === m
                  ? "bg-surface text-warm-900 shadow-sm"
                  : "text-warm-500 hover:text-warm-700"
              }`}
            >
              {m === "light" ? "Hell" : m === "dark" ? "Dunkel" : "System"}
            </button>
          ))}
        </div>
      </div>

      {/* Daten — Export / Import */}
      <div className="rounded-2xl border border-warm-200/80 bg-surface p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest-light">
            <svg className="h-5 w-5 text-forest" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-warm-900">Daten</h2>
            <p className="text-sm text-warm-500">
              Sammlung exportieren oder aus Backup wiederherstellen
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {/* Export */}
          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-forest px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-forest-dark hover:shadow-md disabled:opacity-50 active:scale-[0.98]"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {exporting ? "Exportiere..." : "Sammlung exportieren"}
          </button>

          {exportDone && (
            <div className="flex items-center gap-2 rounded-xl bg-forest-light px-4 py-2.5 text-sm font-medium text-forest">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Backup heruntergeladen!
            </div>
          )}

          {/* Import */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-warm-300 px-5 py-3 text-sm font-semibold text-warm-700 transition-all hover:border-forest hover:text-forest hover:bg-forest-light/30 disabled:opacity-50 active:scale-[0.98]"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Sammlung importieren
          </button>

          {/* Import Error */}
          {importError && (
            <div className="flex items-center gap-2 rounded-xl bg-coral/10 px-4 py-2.5 text-sm font-medium text-coral">
              <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              {importError}
            </div>
          )}

          {/* Import Success */}
          {importDone && (
            <div className="flex items-center gap-2 rounded-xl bg-forest-light px-4 py-2.5 text-sm font-medium text-forest">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {importDone}
            </div>
          )}

          {/* Import Preview Modal */}
          {importPreview && (
            <div className="rounded-xl border border-warm-200 bg-warm-50 p-4 space-y-4">
              <div>
                <h3 className="font-display text-base font-bold text-warm-900 mb-1">Backup-Vorschau</h3>
                <p className="text-xs text-warm-500">
                  Vom {new Date(importPreview.exportedAt).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-surface px-3 py-2 text-center">
                  <div className="font-bold text-warm-900">{importPreview.gameCount}</div>
                  <div className="text-xs text-warm-500">Spiele</div>
                </div>
                <div className="rounded-lg bg-surface px-3 py-2 text-center">
                  <div className="font-bold text-warm-900">{importPreview.sessionCount}</div>
                  <div className="text-xs text-warm-500">Sessions</div>
                </div>
                <div className="rounded-lg bg-surface px-3 py-2 text-center">
                  <div className="font-bold text-warm-900">{importPreview.playerCount}</div>
                  <div className="text-xs text-warm-500">Spieler</div>
                </div>
                <div className="rounded-lg bg-surface px-3 py-2 text-center">
                  <div className="font-bold text-warm-900">{importPreview.playGroupCount}</div>
                  <div className="text-xs text-warm-500">Gruppen</div>
                </div>
              </div>

              {/* Import Mode Selection */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-warm-500 uppercase tracking-wider">Import-Modus</label>
                <div className="flex gap-1.5 rounded-xl bg-warm-100 p-1">
                  <button
                    onClick={() => setImportMode("merge")}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                      importMode === "merge"
                        ? "bg-surface text-warm-900 shadow-sm"
                        : "text-warm-500 hover:text-warm-700"
                    }`}
                  >
                    Bestehende Daten behalten
                  </button>
                  <button
                    onClick={() => setImportMode("replace")}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                      importMode === "replace"
                        ? "bg-coral text-white shadow-sm"
                        : "text-warm-500 hover:text-warm-700"
                    }`}
                  >
                    Alles ersetzen
                  </button>
                </div>
                <p className="text-xs text-warm-500">
                  {importMode === "merge"
                    ? "Neue Daten werden zu deiner bestehenden Sammlung hinzugefügt. Bei gleichen IDs werden Einträge aktualisiert."
                    : "Alle bestehenden Daten werden gelöscht und durch das Backup ersetzt."}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={cancelImport}
                  disabled={importing}
                  className="flex-1 rounded-xl border border-warm-200 px-4 py-2.5 text-sm font-semibold text-warm-600 transition-all hover:bg-warm-100 disabled:opacity-50"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all disabled:opacity-50 active:scale-[0.98] ${
                    importMode === "replace"
                      ? "bg-coral hover:bg-coral-dark"
                      : "bg-forest hover:bg-forest-dark"
                  }`}
                >
                  {importing ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Importiere...
                    </span>
                  ) : (
                    `${importPreview.gameCount} Spiele, ${importPreview.sessionCount} Sessions importieren`
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* App Info */}
      <div className="rounded-2xl border border-warm-200/80 bg-surface p-5">
        <h2 className="font-display text-lg font-bold text-warm-900 mb-3">App-Info</h2>
        <div className="space-y-2.5 text-sm">
          <div className="flex justify-between py-1.5 border-b border-warm-100">
            <span className="text-warm-500">App</span>
            <span className="font-medium text-warm-900">What2Play</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-warm-100">
            <span className="text-warm-500">Spiele in Sammlung</span>
            <span className="font-medium text-warm-900">{gameCount}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-warm-100">
            <span className="text-warm-500">BGG API</span>
            <span className={`font-medium ${bggConfigured ? "text-forest" : "text-warm-400"}`}>
              {bggConfigured ? "Verbunden" : "Nicht konfiguriert"}
            </span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-warm-500">Foto-Scan AI</span>
            <span className={`font-medium ${aiConfigured ? "text-forest" : "text-warm-400"}`}>
              {aiConfigured ? providerLabels[aiProvider] : "Nicht konfiguriert"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
