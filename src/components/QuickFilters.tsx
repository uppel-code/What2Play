"use client";

import type { GameFilters } from "@/types/game";

interface QuickFilter {
  id: string;
  label: string;
  icon: string;
  apply: (filters: GameFilters) => GameFilters;
  isActive: (filters: GameFilters) => boolean;
  remove: (filters: GameFilters) => GameFilters;
}

const QUICK_FILTERS: QuickFilter[] = [
  {
    id: "2-players",
    label: "2 Spieler",
    icon: "👥",
    apply: (f) => ({ ...f, playerCount: 2 }),
    isActive: (f) => f.playerCount === 2,
    remove: (f) => ({ ...f, playerCount: undefined }),
  },
  {
    id: "quick",
    label: "Schnell",
    icon: "⚡",
    apply: (f) => ({ ...f, maxDuration: 30 }),
    isActive: (f) => f.maxDuration === 30,
    remove: (f) => ({ ...f, maxDuration: undefined }),
  },
  {
    id: "party",
    label: "Party",
    icon: "🎉",
    apply: (f) => ({ ...f, playerCount: 5 }),
    isActive: (f) => f.playerCount === 5,
    remove: (f) => ({ ...f, playerCount: undefined }),
  },
  {
    id: "easy",
    label: "Einfach",
    icon: "🌱",
    apply: (f) => ({ ...f, maxComplexity: 2.0, minComplexity: undefined }),
    isActive: (f) => f.maxComplexity === 2.0 && f.minComplexity == null,
    remove: (f) => ({ ...f, maxComplexity: undefined, minComplexity: undefined }),
  },
  {
    id: "expert",
    label: "Kennerspiel",
    icon: "🧠",
    apply: (f) => ({ ...f, minComplexity: 3.0, maxComplexity: undefined }),
    isActive: (f) => f.minComplexity === 3.0 && f.maxComplexity == null,
    remove: (f) => ({ ...f, minComplexity: undefined, maxComplexity: undefined }),
  },
];

interface QuickFiltersProps {
  filters: GameFilters;
  onChange: (filters: GameFilters) => void;
}

export default function QuickFilters({ filters, onChange }: QuickFiltersProps) {
  function toggle(qf: QuickFilter) {
    if (qf.isActive(filters)) {
      onChange(qf.remove(filters));
    } else {
      // For filters that share the same key (e.g. playerCount), deactivate conflicting ones
      let next = filters;
      for (const other of QUICK_FILTERS) {
        if (other.id !== qf.id && other.isActive(next)) {
          // Check if applying qf would override the same keys
          const applied = qf.apply(next);
          const otherApplied = other.apply(next);
          // If they conflict on the same filter key, remove the other first
          if (conflictsWith(qf, other)) {
            next = other.remove(next);
          }
        }
      }
      onChange(qf.apply(next));
    }
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {QUICK_FILTERS.map((qf) => {
        const active = qf.isActive(filters);
        return (
          <button
            key={qf.id}
            onClick={() => toggle(qf)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-all active:scale-95 ${
              active
                ? "bg-forest text-white shadow-sm"
                : "bg-surface text-warm-600 ring-1 ring-warm-200 hover:bg-warm-50"
            }`}
          >
            <span className="text-sm">{qf.icon}</span>
            {qf.label}
          </button>
        );
      })}
    </div>
  );
}

/** Two quick filters conflict if they set the same underlying filter key */
function conflictsWith(a: QuickFilter, b: QuickFilter): boolean {
  const conflicts: Record<string, string[]> = {
    "2-players": ["party"],
    party: ["2-players"],
    easy: ["expert"],
    expert: ["easy"],
  };
  return conflicts[a.id]?.includes(b.id) ?? false;
}
