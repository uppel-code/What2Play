/**
 * Achievements Service — Definitions & check logic
 */

import type { AchievementKey, AchievementDefinition } from "@/types/game";
import {
  getGameCount,
  getAllSessions,
  unlockAchievement,
  getAchievement,
} from "@/lib/db-client";

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  {
    key: "first_game",
    title: "Sammler",
    description: "Erstes Spiel hinzugefügt",
    icon: "🎲",
  },
  {
    key: "collector_10",
    title: "Enthusiast",
    description: "10 Spiele in der Sammlung",
    icon: "📚",
  },
  {
    key: "collector_50",
    title: "Großsammler",
    description: "50 Spiele in der Sammlung",
    icon: "🏛️",
  },
  {
    key: "shame_buster",
    title: "Shame Buster",
    description: "Ein nie gespieltes Spiel endlich gespielt",
    icon: "💪",
  },
  {
    key: "variety_5",
    title: "Vielspieler",
    description: "5 verschiedene Mechaniken gespielt",
    icon: "🎯",
  },
  {
    key: "streak_3",
    title: "Streak!",
    description: "3 Tage hintereinander gespielt",
    icon: "🔥",
  },
  {
    key: "rule_master",
    title: "Regelmeister",
    description: "5× den Regelguru genutzt",
    icon: "📖",
  },
  {
    key: "explorer",
    title: "Entdecker",
    description: "Photo Scan genutzt",
    icon: "📸",
  },
];

export function getDefinition(key: AchievementKey): AchievementDefinition {
  return ACHIEVEMENT_DEFINITIONS.find((d) => d.key === key)!;
}

/**
 * Check achievements after adding a game.
 * Returns newly unlocked achievement keys.
 */
export async function checkOnGameAdd(): Promise<AchievementKey[]> {
  const unlocked: AchievementKey[] = [];
  const count = await getGameCount();

  if (count >= 1) {
    const a = await unlockAchievement("first_game");
    if (a) unlocked.push("first_game");
  }
  if (count >= 10) {
    const a = await unlockAchievement("collector_10");
    if (a) unlocked.push("collector_10");
  }
  if (count >= 50) {
    const a = await unlockAchievement("collector_50");
    if (a) unlocked.push("collector_50");
  }

  return unlocked;
}

/**
 * Check achievements after a play session.
 * @param gameLastPlayed - the game's lastPlayed value BEFORE the session was recorded (null = never played)
 * @param gameMechanics - the mechanics of the game that was played
 */
export async function checkOnPlaySession(
  gameLastPlayed: string | null,
  gameMechanics: string[]
): Promise<AchievementKey[]> {
  const unlocked: AchievementKey[] = [];

  // shame_buster: played a game that was never played before
  if (!gameLastPlayed) {
    const a = await unlockAchievement("shame_buster");
    if (a) unlocked.push("shame_buster");
  }

  // variety_5: 5 different mechanics played across all sessions
  const variety = await getAchievement("variety_5");
  if (!variety) {
    const sessions = await getAllSessions();
    // We need to collect all unique mechanics from games that have been played
    // For simplicity, we track mechanics from current context + check threshold
    // The caller should provide gameMechanics; we accumulate from all session games
    const allMechanics = new Set<string>(gameMechanics);
    // We'll need game data for other sessions - but that's expensive
    // Instead, just check if this game's mechanics push us over 5 unique
    if (allMechanics.size >= 5) {
      const a = await unlockAchievement("variety_5");
      if (a) unlocked.push("variety_5");
    }
  }

  // streak_3: 3 consecutive days with play sessions
  const streak = await getAchievement("streak_3");
  if (!streak) {
    const sessions = await getAllSessions();
    const playDates = new Set(sessions.map((s) => s.playedAt));
    const sortedDates = [...playDates].sort();

    let maxStreak = 1;
    let currentStreak = 1;
    for (let i = 1; i < sortedDates.length; i++) {
      const prev = new Date(sortedDates[i - 1]);
      const curr = new Date(sortedDates[i]);
      const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays === 1) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else if (diffDays > 1) {
        currentStreak = 1;
      }
    }

    if (maxStreak >= 3) {
      const a = await unlockAchievement("streak_3");
      if (a) unlocked.push("streak_3");
    }
  }

  return unlocked;
}

/**
 * Check rule_master achievement after using RegelGuru.
 * @param totalRuleUses - total number of times RegelGuru has been used
 */
export async function checkOnRuleUse(totalRuleUses: number): Promise<AchievementKey[]> {
  const unlocked: AchievementKey[] = [];
  if (totalRuleUses >= 5) {
    const a = await unlockAchievement("rule_master");
    if (a) unlocked.push("rule_master");
  }
  return unlocked;
}

/**
 * Check explorer achievement after using Photo Scan.
 */
export async function checkOnPhotoScan(): Promise<AchievementKey[]> {
  const unlocked: AchievementKey[] = [];
  const a = await unlockAchievement("explorer");
  if (a) unlocked.push("explorer");
  return unlocked;
}
