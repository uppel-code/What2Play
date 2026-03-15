"use client";

import { useState, useEffect } from "react";
import { getBggToken, setBggToken, isBggConfigured } from "@/services/bgg-client";
import { getGameCount } from "@/lib/db-client";

export default function SettingsPage() {
  const [token, setToken] = useState("");
  const [savedToken, setSavedToken] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [gameCount, setGameCount] = useState<number>(0);

  useEffect(() => {
    async function load() {
      const t = await getBggToken();
      setSavedToken(t);
      if (t) setToken(t);
      const c = await isBggConfigured();
      setConfigured(c);
      const count = await getGameCount();
      setGameCount(count);
    }
    load();
  }, []);

  async function handleSaveToken() {
    if (!token.trim()) return;
    setSaving(true);
    try {
      await setBggToken(token.trim());
      setSavedToken(token.trim());
      setConfigured(true);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  async function handleClearToken() {
    await setBggToken("");
    setToken("");
    setSavedToken(null);
    setConfigured(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-warm-900">Einstellungen</h1>
        <p className="mt-1 text-sm font-medium text-warm-500">App-Konfiguration</p>
      </div>

      {/* BGG API Token */}
      <div className="rounded-2xl border border-warm-200/80 bg-white p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${configured ? "bg-forest-light" : "bg-amber-light"}`}>
            <svg className={`h-5 w-5 ${configured ? "text-forest" : "text-amber-dark"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-warm-900">BGG API-Token</h2>
            <p className="text-sm text-warm-500">
              {configured
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
              onChange={(e) => { setToken(e.target.value); setSaved(false); }}
              placeholder="Dein BGG API-Token einfügen..."
              className="flex-1 rounded-xl border border-warm-200 bg-warm-50/50 px-3.5 py-2.5 text-sm font-mono text-warm-800 placeholder:text-warm-400 transition-colors focus:border-forest focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest/10"
            />
            <button
              onClick={handleSaveToken}
              disabled={saving || !token.trim() || token.trim() === savedToken}
              className="rounded-xl bg-forest px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-forest-dark hover:shadow-md disabled:opacity-50 active:scale-[0.98]"
            >
              {saving ? "Speichern..." : "Speichern"}
            </button>
          </div>

          {saved && (
            <div className="flex items-center gap-2 rounded-xl bg-forest-light px-4 py-2.5 text-sm font-medium text-forest">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Token gespeichert! BGG-Features sind jetzt aktiv.
            </div>
          )}

          {savedToken && !saved && (
            <button
              onClick={handleClearToken}
              className="text-sm text-coral hover:text-coral-dark font-medium transition-colors"
            >
              Token entfernen
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
            <span className="text-warm-500">Datenbank</span>
            <span className="font-medium text-warm-900">IndexedDB (lokal)</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-warm-500">BGG API</span>
            <span className={`font-medium ${configured ? "text-forest" : "text-warm-400"}`}>
              {configured ? "Verbunden" : "Nicht konfiguriert"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
