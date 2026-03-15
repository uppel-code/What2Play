"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { Game } from "@/types/game";
import { PREDEFINED_TAGS } from "@/types/game";
import { getGameById, updateGame, deleteGame } from "@/lib/db-client";

function EditGameContent() {
  const searchParams = useSearchParams();
  const id = Number(searchParams.get("id"));
  const router = useRouter();
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    minPlayers: 1,
    maxPlayers: 4,
    playingTime: 30,
    minAge: 0,
    averageWeight: 2.0,
    yearpublished: null as number | null,
    tags: [] as string[],
    notes: "" as string,
  });
  const [customTag, setCustomTag] = useState("");

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    getGameById(id)
      .then((data) => {
        if (data) {
          setGame(data);
          setForm({
            name: data.name,
            minPlayers: data.minPlayers,
            maxPlayers: data.maxPlayers,
            playingTime: data.playingTime,
            minAge: data.minAge,
            averageWeight: data.averageWeight,
            yearpublished: data.yearpublished,
            tags: data.tags || [],
            notes: data.notes || "",
          });
        }
      })
      .catch(() => setGame(null))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await updateGame(id, form);
    router.push(`/game?id=${id}`);
  }

  async function handleDelete() {
    if (!confirm("Spiel wirklich löschen?")) return;
    await deleteGame(id);
    router.push("/");
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  if (!game) {
    return <p className="mt-16 text-center font-display text-lg font-semibold text-warm-700">Spiel nicht gefunden.</p>;
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-bold tracking-tight text-warm-900">Spiel bearbeiten</h1>
      <p className="mt-1 text-sm font-medium text-warm-500">{game.name}</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5 rounded-2xl border border-warm-200/80 bg-white p-5">
        <FormField label="Name">
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-xl border border-warm-200 bg-warm-50/50 px-3.5 py-2.5 text-sm text-warm-800 transition-colors focus:border-forest focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest/10"
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Min. Spieler">
            <input
              type="number"
              min={1}
              max={99}
              value={form.minPlayers}
              onChange={(e) => setForm({ ...form, minPlayers: Number(e.target.value) })}
              className="w-full rounded-xl border border-warm-200 bg-warm-50/50 px-3.5 py-2.5 text-sm text-warm-800 transition-colors focus:border-forest focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest/10"
            />
          </FormField>
          <FormField label="Max. Spieler">
            <input
              type="number"
              min={1}
              max={99}
              value={form.maxPlayers}
              onChange={(e) => setForm({ ...form, maxPlayers: Number(e.target.value) })}
              className="w-full rounded-xl border border-warm-200 bg-warm-50/50 px-3.5 py-2.5 text-sm text-warm-800 transition-colors focus:border-forest focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest/10"
            />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Spieldauer (Min)">
            <input
              type="number"
              min={1}
              value={form.playingTime}
              onChange={(e) => setForm({ ...form, playingTime: Number(e.target.value) })}
              className="w-full rounded-xl border border-warm-200 bg-warm-50/50 px-3.5 py-2.5 text-sm text-warm-800 transition-colors focus:border-forest focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest/10"
            />
          </FormField>
          <FormField label="Mindestalter">
            <input
              type="number"
              min={0}
              value={form.minAge}
              onChange={(e) => setForm({ ...form, minAge: Number(e.target.value) })}
              className="w-full rounded-xl border border-warm-200 bg-warm-50/50 px-3.5 py-2.5 text-sm text-warm-800 transition-colors focus:border-forest focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest/10"
            />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Komplexität (1–5)">
            <input
              type="number"
              min={1}
              max={5}
              step={0.1}
              value={form.averageWeight}
              onChange={(e) => setForm({ ...form, averageWeight: Number(e.target.value) })}
              className="w-full rounded-xl border border-warm-200 bg-warm-50/50 px-3.5 py-2.5 text-sm text-warm-800 transition-colors focus:border-forest focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest/10"
            />
          </FormField>
          <FormField label="Erscheinungsjahr">
            <input
              type="number"
              value={form.yearpublished ?? ""}
              onChange={(e) => setForm({ ...form, yearpublished: e.target.value ? Number(e.target.value) : null })}
              className="w-full rounded-xl border border-warm-200 bg-warm-50/50 px-3.5 py-2.5 text-sm text-warm-800 transition-colors focus:border-forest focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest/10"
            />
          </FormField>
        </div>

        {/* Tags */}
        <div>
          <label className="mb-2 block text-xs font-semibold text-warm-500 uppercase tracking-wider">Tags</label>
          
          {/* Predefined tags */}
          <div className="flex flex-wrap gap-2 mb-3">
            {PREDEFINED_TAGS.map((tag) => {
              const isSelected = form.tags.includes(tag.value);
              return (
                <button
                  key={tag.value}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      setForm({ ...form, tags: form.tags.filter((t) => t !== tag.value) });
                    } else {
                      setForm({ ...form, tags: [...form.tags, tag.value] });
                    }
                  }}
                  className={`rounded-xl px-3 py-1.5 text-sm font-medium transition-all ${
                    isSelected
                      ? "bg-forest text-white"
                      : "bg-warm-100 text-warm-600 hover:bg-warm-200"
                  }`}
                >
                  {tag.label}
                </button>
              );
            })}
          </div>

          {/* Custom tags */}
          {form.tags.filter((t) => !PREDEFINED_TAGS.some((p) => p.value === t)).length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {form.tags
                .filter((t) => !PREDEFINED_TAGS.some((p) => p.value === t))
                .map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-xl bg-amber-light px-3 py-1.5 text-sm font-medium text-amber-dark"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, tags: form.tags.filter((t) => t !== tag) })}
                      className="ml-1 hover:text-coral"
                    >
                      ×
                    </button>
                  </span>
                ))}
            </div>
          )}

          {/* Add custom tag */}
          <div className="flex gap-2">
            <input
              type="text"
              value={customTag}
              onChange={(e) => setCustomTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && customTag.trim()) {
                  e.preventDefault();
                  if (!form.tags.includes(customTag.trim())) {
                    setForm({ ...form, tags: [...form.tags, customTag.trim()] });
                  }
                  setCustomTag("");
                }
              }}
              placeholder="Eigenen Tag hinzufügen..."
              className="flex-1 rounded-xl border border-warm-200 bg-warm-50/50 px-3.5 py-2 text-sm text-warm-800 placeholder:text-warm-400 transition-colors focus:border-forest focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest/10"
            />
            <button
              type="button"
              onClick={() => {
                if (customTag.trim() && !form.tags.includes(customTag.trim())) {
                  setForm({ ...form, tags: [...form.tags, customTag.trim()] });
                  setCustomTag("");
                }
              }}
              disabled={!customTag.trim()}
              className="rounded-xl bg-warm-100 px-4 py-2 text-sm font-medium text-warm-600 transition-colors hover:bg-warm-200 disabled:opacity-50"
            >
              +
            </button>
          </div>
        </div>

        {/* Notes */}
        <FormField label="Notizen">
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={3}
            placeholder="Eigene Notizen zum Spiel..."
            className="w-full rounded-xl border border-warm-200 bg-warm-50/50 px-3.5 py-2.5 text-sm text-warm-800 placeholder:text-warm-400 transition-colors focus:border-forest focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest/10"
          />
        </FormField>

        <div className="flex gap-3 border-t border-warm-100 pt-5">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-forest px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-forest-dark hover:shadow-md disabled:opacity-50 active:scale-[0.98]"
          >
            Speichern
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-xl bg-warm-100 px-5 py-2.5 text-sm font-medium text-warm-600 transition-colors hover:bg-warm-200"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="ml-auto rounded-xl bg-coral-light px-5 py-2.5 text-sm font-medium text-coral transition-colors hover:bg-red-100"
          >
            Löschen
          </button>
        </div>
      </form>
    </div>
  );
}

export default function EditGamePage() {
  return (
    <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center"><div className="spinner" /></div>}>
      <EditGameContent />
    </Suspense>
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
