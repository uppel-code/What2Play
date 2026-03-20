"use client";

import { useState, useEffect } from "react";
import type { AchievementKey } from "@/types/game";
import { getDefinition } from "@/services/achievements";

interface AchievementToastProps {
  achievementKey: AchievementKey;
  onDone: () => void;
}

export default function AchievementToast({ achievementKey, onDone }: AchievementToastProps) {
  const [visible, setVisible] = useState(false);
  const def = getDefinition(achievementKey);

  useEffect(() => {
    // Slide in
    const showTimer = setTimeout(() => setVisible(true), 50);
    // Auto-hide after 4s
    const hideTimer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDone, 400);
    }, 4000);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [onDone]);

  return (
    <div
      className={`fixed top-4 left-1/2 z-[100] -translate-x-1/2 transition-all duration-400 ${
        visible ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0"
      }`}
    >
      <div className="flex items-center gap-3 rounded-2xl bg-warm-900 dark:bg-warm-800 px-5 py-3 shadow-lg">
        <span className="text-2xl">{def.icon}</span>
        <div>
          <div className="text-xs font-medium text-amber-400">Achievement freigeschaltet!</div>
          <div className="text-sm font-bold text-white">{def.title}</div>
        </div>
        <span className="ml-1 text-lg">🏆</span>
      </div>
    </div>
  );
}
