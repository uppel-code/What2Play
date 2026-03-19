"use client";

import { useState } from "react";
import type { GameFilters } from "@/types/game";
import { PREDEFINED_TAGS } from "@/types/game";

interface FilterBarProps {
  filters: GameFilters;
  onChange: (filters: GameFilters) => void;
}

export default function FilterBar({ filters, onChange }: FilterBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const updateFilter = (key: keyof GameFilters, value: string) => {
    const numValue = value === "" ? undefined : Number(value);
    onChange({ ...filters, [key]: key === "search" ? value || undefined : numValue });
  };

  const activeFilterCount = [
    filters.playerCount,
    filters.maxDuration,
    filters.minComplexity || filters.maxComplexity,
    filters.minAge,
    filters.tags?.length,
    filters.sortBy,
  ].filter(Boolean).length;

  return (
    <div className="rounded-2xl border border-warm-200/80 bg-surface p-4">
      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-warm-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Spiel suchen..."
            value={filters.search || ""}
            onChange={(e) => updateFilter("search", e.target.value)}
            className="w-full rounded-xl border border-warm-200 bg-warm-50/50 py-2.5 pl-10 pr-3 text-sm text-warm-900 placeholder:text-warm-400 transition-colors focus:border-forest focus:bg-surface focus:outline-none focus:ring-2 focus:ring-forest/10"
          />
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-all ${
            activeFilterCount > 0
              ? "border-forest/30 bg-forest-light text-forest"
              : "border-warm-200 text-warm-600 hover:bg-warm-50"
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Filter
          {activeFilterCount > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-forest text-[10px] font-bold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Expanded filters */}
      {isExpanded && (
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-warm-100 pt-4 sm:grid-cols-4">
          <FilterSelect
            label="Spieleranzahl"
            value={filters.playerCount ?? ""}
            onChange={(v) => updateFilter("playerCount", v)}
          >
            <option value="">Egal</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>{n} Spieler</option>
            ))}
          </FilterSelect>

          <FilterSelect
            label="Max. Dauer"
            value={filters.maxDuration ?? ""}
            onChange={(v) => updateFilter("maxDuration", v)}
          >
            <option value="">Egal</option>
            <option value="30">bis 30 Min</option>
            <option value="60">bis 60 Min</option>
            <option value="90">bis 90 Min</option>
            <option value="120">bis 2 Std</option>
            <option value="180">bis 3 Std</option>
            <option value="240">bis 4 Std</option>
          </FilterSelect>

          <FilterSelect
            label="Komplexität"
            value={filters.maxComplexity ?? ""}
            onChange={(val) => {
              if (val === "") {
                onChange({ ...filters, minComplexity: undefined, maxComplexity: undefined });
              } else {
                const [min, max] = val.split("-").map(Number);
                onChange({ ...filters, minComplexity: min, maxComplexity: max });
              }
            }}
          >
            <option value="">Egal</option>
            <option value="1-1.5">Leicht (1–1.5)</option>
            <option value="1.5-2.5">Mittel (1.5–2.5)</option>
            <option value="2.5-3.5">Gehoben (2.5–3.5)</option>
            <option value="3.5-5">Schwer (3.5–5)</option>
          </FilterSelect>

          <FilterSelect
            label="Mindestalter"
            value={filters.minAge ?? ""}
            onChange={(v) => updateFilter("minAge", v)}
          >
            <option value="">Egal</option>
            <option value="6">ab 6+</option>
            <option value="8">ab 8+</option>
            <option value="10">ab 10+</option>
            <option value="12">ab 12+</option>
            <option value="14">ab 14+</option>
          </FilterSelect>

          <FilterSelect
            label="Sortierung"
            value={filters.sortBy === "lastPlayed" ? `lastPlayed-${filters.sortDirection || "asc"}` : ""}
            onChange={(v) => {
              if (v === "") {
                onChange({ ...filters, sortBy: undefined, sortDirection: undefined });
              } else {
                const [, dir] = v.split("-");
                onChange({ ...filters, sortBy: "lastPlayed", sortDirection: dir as "asc" | "desc" });
              }
            }}
          >
            <option value="">A–Z (Standard)</option>
            <option value="lastPlayed-desc">Zuletzt gespielt ↓</option>
            <option value="lastPlayed-asc">Zuletzt gespielt ↑</option>
          </FilterSelect>

          {/* Tag filter */}
          <div className="col-span-2 sm:col-span-4">
            <label className="mb-1.5 block text-xs font-medium text-warm-500">Tags</label>
            <div className="flex flex-wrap gap-1.5">
              {PREDEFINED_TAGS.map((tag) => {
                const isSelected = filters.tags?.includes(tag.value);
                return (
                  <button
                    key={tag.value}
                    onClick={() => {
                      const currentTags = filters.tags || [];
                      const newTags = isSelected
                        ? currentTags.filter((t) => t !== tag.value)
                        : [...currentTags, tag.value];
                      onChange({ ...filters, tags: newTags.length > 0 ? newTags : undefined });
                    }}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                      isSelected
                        ? "bg-forest text-white"
                        : "bg-warm-50 text-warm-600 hover:bg-warm-100"
                    }`}
                  >
                    {tag.label}
                  </button>
                );
              })}
            </div>
          </div>

          {activeFilterCount > 0 && (
            <button
              onClick={() => onChange({ search: filters.search })}
              className="col-span-2 mt-1 text-xs font-medium text-forest hover:text-forest-dark sm:col-span-4"
            >
              Alle Filter zurücksetzen
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string | number;
  onChange: (val: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-warm-500">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-warm-200 bg-warm-50/50 px-2.5 py-2 text-sm text-warm-800 transition-colors focus:border-forest focus:bg-surface focus:outline-none focus:ring-2 focus:ring-forest/10"
      >
        {children}
      </select>
    </div>
  );
}
