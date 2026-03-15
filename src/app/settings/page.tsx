"use client";

import { useState, useEffect } from "react";
import { getBggToken, setBggToken, isBggConfigured } from "@/services/bgg-client";
import { getAiConfig, setAiConfig, clearAiConfig, isAiConfigured } from "@/services/ai-client";
import type { AiProvider } from "@/services/ai-client";
import { getGameCount } from "@/lib/db-client";

export default function SettingsPage() {
  const [token, setToken] = useState("");
  const [savedToken, setSavedToken] = useState<string | null>(null);
  const [bggConfigured, setBggConfigured] = useState<boolean | null>(null);
  const [bggSaving, setBggSaving] = useState(false);
  const [bggSaved, setBggSaved] = useState(false);

  const [aiProvider, setAiProvider] = useState<AiProvider>("gemini");
  const [aiKey, setAiKey] = useState("");
  const [savedAiKey, setSavedAiKey] = useState<string | null>(null);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiSaved, setAiSaved] = useState(false);

  const [gameCount, setGameCount] = useState<number>(0);

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

  const providerLabels: Record<AiProvider, string> = {
    gemini: "Google Gemini",
    openai: "OpenAI",
    claude: "Anthropic Claude",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-warm-900">Einstellungen</h1>
        <p className="mt-1 text-sm font-medium text-warm-500">App-Konfiguration</p>
      </div>

      {/* BGG API Token */}
      <div className="rounded-2xl border border-warm-200/80 bg-white p-5">
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
              className="flex-1 rounded-xl border border-warm-200 bg-warm-50/50 px-3.5 py-2.5 text-sm font-mono text-warm-800 placeholder:text-warm-400 transition-colors focus:border-forest focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest/10"
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
            <button
              onClick={handleClearBggToken}
              className="text-sm text-coral hover:text-coral-dark font-medium transition-colors"
            >
              Token entfernen
            </button>
          )}
        </div>
      </div>

      {/* AI Provider for Photo Scan */}
      <div className="rounded-2xl border border-warm-200/80 bg-white p-5">
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

        <div className="rounded-xl bg-warm-50 p-4 mb-4">
          <p className="text-sm text-warm-600 leading-relaxed">
            Für den Foto-Scan brauchst du einen AI-API-Key. <strong>Google Gemini</strong> ist empfohlen
            — der API-Key ist kostenlos (keine Kreditkarte nötig).
          </p>
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-forest hover:text-forest-dark transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Kostenlosen Gemini API-Key erstellen →
          </a>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-warm-500 uppercase tracking-wider mb-1.5">AI-Provider</label>
            <div className="flex gap-1.5 rounded-xl bg-warm-100 p-1">
              {(["gemini", "openai", "claude"] as AiProvider[]).map((p) => (
                <button
                  key={p}
                  onClick={() => { setAiProvider(p); setAiSaved(false); }}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                    aiProvider === p
                      ? "bg-white text-warm-900 shadow-sm"
                      : "text-warm-500 hover:text-warm-700"
                  }`}
                >
                  {providerLabels[p]}
                </button>
              ))}
            </div>
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
                className="flex-1 rounded-xl border border-warm-200 bg-warm-50/50 px-3.5 py-2.5 text-sm font-mono text-warm-800 placeholder:text-warm-400 transition-colors focus:border-forest focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest/10"
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
            <button
              onClick={handleClearAiConfig}
              className="text-sm text-coral hover:text-coral-dark font-medium transition-colors"
            >
              AI-Konfiguration entfernen
            </button>
          )}
        </div>
      </div>

      {/* App Info */}
      <div className="rounded-2xl border border-warm-200/80 bg-white p-5">
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
