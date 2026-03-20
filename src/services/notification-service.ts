/**
 * Notification Service — Local push notifications via Capacitor
 *
 * Notification types:
 * 1. Unplayed reminder: "Du hast [Spiel] seit 3 Monaten nicht gespielt!" (weekly check)
 * 2. Game night reminder: "Spieleabend morgen!" (1 day before)
 * 3. Loan overdue: "Hol [Spiel] von [Person] zurück!" (after 4 weeks)
 * 4. Achievement unlocked
 */

import { Preferences } from "@capacitor/preferences";

// ─── Types ───

export interface PendingNotification {
  id: number;
  title: string;
  body: string;
  scheduleAt: Date;
  type: "unplayed" | "game-night" | "loan-overdue" | "achievement";
}

export interface NotificationCheckData {
  games: { id: number; name: string; lastPlayed: string | null; owned: boolean }[];
  loans: { id: number; gameId: number; personName: string; loanDate: string; returnedAt: string | null }[];
  gameNights: { id: number; name: string; date: string }[];
  now?: Date; // injectable for testing
}

// ─── Preferences Key ───

const NOTIFICATIONS_ENABLED_KEY = "notifications_enabled";

export async function getNotificationsEnabled(): Promise<boolean> {
  const { value } = await Preferences.get({ key: NOTIFICATIONS_ENABLED_KEY });
  return value === "true";
}

export async function setNotificationsEnabled(enabled: boolean): Promise<void> {
  await Preferences.set({ key: NOTIFICATIONS_ENABLED_KEY, value: String(enabled) });
}

// ─── Notification ID Generation ───
// Use stable IDs based on type + entity ID to avoid duplicates

function makeId(type: number, entityId: number): number {
  return type * 100000 + entityId;
}

// ─── Compute Pending Notifications ───

export function computePendingNotifications(data: NotificationCheckData): PendingNotification[] {
  const now = data.now ?? new Date();
  const notifications: PendingNotification[] = [];

  // 1. Unplayed for 3+ months
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const threeMonthsStr = threeMonthsAgo.toISOString().split("T")[0];

  for (const game of data.games) {
    if (!game.owned) continue;
    if (game.lastPlayed === null || game.lastPlayed <= threeMonthsStr) {
      // Schedule for next Monday 10:00
      const nextMonday = getNextWeekday(now, 1);
      nextMonday.setHours(10, 0, 0, 0);

      notifications.push({
        id: makeId(1, game.id),
        title: "Lange nicht gespielt!",
        body: `Du hast ${game.name} seit 3 Monaten nicht gespielt!`,
        scheduleAt: nextMonday,
        type: "unplayed",
      });
    }
  }

  // 2. Game night tomorrow
  const tomorrowStr = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  for (const gn of data.gameNights) {
    const gnDate = gn.date.split("T")[0];
    if (gnDate === tomorrowStr) {
      const scheduleAt = new Date(now);
      scheduleAt.setHours(18, 0, 0, 0);

      notifications.push({
        id: makeId(2, gn.id),
        title: "Spieleabend morgen!",
        body: `Morgen ist "${gn.name}" — vergiss nicht deine Spiele!`,
        scheduleAt,
        type: "game-night",
      });
    }
  }

  // 3. Loan overdue (4+ weeks)
  const fourWeeksAgo = new Date(now);
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  const fourWeeksStr = fourWeeksAgo.toISOString().split("T")[0];

  for (const loan of data.loans) {
    if (loan.returnedAt !== null) continue;
    if (loan.loanDate <= fourWeeksStr) {
      const gameName = data.games.find((g) => g.id === loan.gameId)?.name ?? "ein Spiel";
      const scheduleAt = new Date(now);
      scheduleAt.setHours(11, 0, 0, 0);

      notifications.push({
        id: makeId(3, loan.id),
        title: "Spiel zurückholen!",
        body: `Hol ${gameName} von ${loan.personName} zurück!`,
        scheduleAt,
        type: "loan-overdue",
      });
    }
  }

  return notifications;
}

// ─── Achievement Notification ───

export function createAchievementNotification(
  achievementTitle: string,
  achievementId: number,
): PendingNotification {
  return {
    id: makeId(4, achievementId),
    title: "Achievement freigeschaltet!",
    body: `Neues Achievement: ${achievementTitle}`,
    scheduleAt: new Date(),
    type: "achievement",
  };
}

// ─── Schedule via Capacitor ───

let isScheduling = false;

export async function scheduleNotifications(notifications: PendingNotification[]): Promise<void> {
  if (isScheduling || notifications.length === 0) return;
  isScheduling = true;

  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");

    // Request permission
    const perm = await LocalNotifications.requestPermissions();
    if (perm.display !== "granted") return;

    // Cancel existing scheduled notifications first
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications });
    }

    // Schedule new ones
    await LocalNotifications.schedule({
      notifications: notifications.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        schedule: { at: n.scheduleAt },
        sound: undefined,
        smallIcon: "ic_notification",
      })),
    });
  } catch {
    // Capacitor not available (web/test environment) — silently ignore
  } finally {
    isScheduling = false;
  }
}

// ─── Run Full Check ───

export async function runNotificationCheck(data: NotificationCheckData): Promise<void> {
  const enabled = await getNotificationsEnabled();
  if (!enabled) return;

  const pending = computePendingNotifications(data);
  await scheduleNotifications(pending);
}

// ─── Helpers ───

function getNextWeekday(from: Date, weekday: number): Date {
  const result = new Date(from);
  const currentDay = result.getDay();
  const daysUntil = (weekday - currentDay + 7) % 7 || 7;
  result.setDate(result.getDate() + daysUntil);
  return result;
}
