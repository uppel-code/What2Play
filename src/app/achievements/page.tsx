"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { Achievement } from "@/types/game";
import { getAllAchievements } from "@/lib/db-client";
import { ACHIEVEMENT_DEFINITIONS } from "@/services/achievements";

export default function AchievementsPage() {
  const [unlocked, setUnlocked] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllAchievements().then((a) => {
      setUnlocked(a);
      setLoading(false);
    });
  }, []);

  const unlockedKeys = new Set(unlocked.map((a) => a.key));
  const unlockedCount = unlocked.length;
  const totalCount = ACHIEVEMENT_DEFINITIONS.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-warm-900">Achievements</h1>
          <p className="mt-1 text-sm text-warm-500">
            {loading ? "..." : `${unlockedCount} von ${totalCount} freigeschaltet`}
          </p>
        </div>
        <Link
          href="/settings"
          className="rounded-xl bg-warm-100 px-3 py-2 text-sm font-medium text-warm-600 hover:bg-warm-200"
        >
          Zurück
        </Link>
      </div>

      {/* Progress bar */}
      {!loading && (
        <div className="overflow-hidden rounded-full bg-warm-100">
          <div
            className="h-2 rounded-full bg-forest transition-all duration-500"
            style={{ width: `${(unlockedCount / totalCount) * 100}%` }}
          />
        </div>
      )}

      {/* Badge grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {ACHIEVEMENT_DEFINITIONS.map((def) => {
          const isUnlocked = unlockedKeys.has(def.key);
          const achievement = unlocked.find((a) => a.key === def.key);

          return (
            <div
              key={def.key}
              className={`relative flex flex-col items-center rounded-2xl border-2 p-4 text-center transition-all ${
                isUnlocked
                  ? "border-amber-300 bg-amber-50 shadow-sm"
                  : "border-warm-200 bg-warm-50 opacity-50"
              }`}
            >
              <span className={`text-4xl ${isUnlocked ? "" : "grayscale"}`}>
                {def.icon}
              </span>
              <h3 className="mt-2 text-sm font-bold text-warm-900">{def.title}</h3>
              <p className="mt-0.5 text-xs text-warm-500">{def.description}</p>
              {isUnlocked && achievement && (
                <p className="mt-2 text-[10px] text-amber-600">
                  {new Date(achievement.unlockedAt).toLocaleDateString("de-DE")}
                </p>
              )}
              {!isUnlocked && (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl">
                  <span className="text-3xl opacity-30">🔒</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
