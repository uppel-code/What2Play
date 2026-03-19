import { describe, it, expect } from "vitest";
import {
  computePendingNotifications,
  createAchievementNotification,
  type NotificationCheckData,
} from "@/services/notification-service";

const NOW = new Date("2026-03-19T12:00:00Z");

function makeData(
  overrides: Partial<NotificationCheckData> = {},
): NotificationCheckData {
  return {
    games: [],
    loans: [],
    gameNights: [],
    now: NOW,
    ...overrides,
  };
}

describe("notification-service", () => {
  // ─── Unplayed Reminders ───

  describe("unplayed game reminders", () => {
    it("creates notification for game not played in 3+ months", () => {
      const data = makeData({
        games: [
          { id: 1, name: "Catan", lastPlayed: "2025-12-01", owned: true },
        ],
      });

      const result = computePendingNotifications(data);
      expect(result.length).toBe(1);
      expect(result[0].type).toBe("unplayed");
      expect(result[0].body).toContain("Catan");
      expect(result[0].body).toContain("3 Monaten");
    });

    it("creates notification for game never played", () => {
      const data = makeData({
        games: [
          { id: 1, name: "Azul", lastPlayed: null, owned: true },
        ],
      });

      const result = computePendingNotifications(data);
      expect(result.length).toBe(1);
      expect(result[0].type).toBe("unplayed");
      expect(result[0].body).toContain("Azul");
    });

    it("does NOT notify for recently played game", () => {
      const data = makeData({
        games: [
          { id: 1, name: "Catan", lastPlayed: "2026-03-10", owned: true },
        ],
      });

      const result = computePendingNotifications(data);
      expect(result.length).toBe(0);
    });

    it("does NOT notify for non-owned games", () => {
      const data = makeData({
        games: [
          { id: 1, name: "Catan", lastPlayed: null, owned: false },
        ],
      });

      const result = computePendingNotifications(data);
      expect(result.length).toBe(0);
    });

    it("schedules unplayed reminders for next Monday", () => {
      const data = makeData({
        games: [
          { id: 1, name: "Catan", lastPlayed: null, owned: true },
        ],
      });

      const result = computePendingNotifications(data);
      expect(result[0].scheduleAt.getDay()).toBe(1); // Monday
      expect(result[0].scheduleAt.getHours()).toBe(10);
    });

    it("handles multiple unplayed games", () => {
      const data = makeData({
        games: [
          { id: 1, name: "Catan", lastPlayed: null, owned: true },
          { id: 2, name: "Azul", lastPlayed: "2025-11-01", owned: true },
          { id: 3, name: "Ticket", lastPlayed: "2026-03-18", owned: true },
        ],
      });

      const result = computePendingNotifications(data);
      expect(result.length).toBe(2);
      expect(result.map((n) => n.type)).toEqual(["unplayed", "unplayed"]);
    });
  });

  // ─── Game Night Reminders ───

  describe("game night reminders", () => {
    it("creates notification for game night tomorrow", () => {
      const data = makeData({
        gameNights: [
          { id: 1, name: "Freitagsrunde", date: "2026-03-20T19:00:00" },
        ],
      });

      const result = computePendingNotifications(data);
      expect(result.length).toBe(1);
      expect(result[0].type).toBe("game-night");
      expect(result[0].body).toContain("Freitagsrunde");
      expect(result[0].title).toBe("Spieleabend morgen!");
    });

    it("does NOT notify for game night today", () => {
      const data = makeData({
        gameNights: [
          { id: 1, name: "Heute", date: "2026-03-19T19:00:00" },
        ],
      });

      const result = computePendingNotifications(data);
      expect(result.length).toBe(0);
    });

    it("does NOT notify for game night in 2 days", () => {
      const data = makeData({
        gameNights: [
          { id: 1, name: "Later", date: "2026-03-21T19:00:00" },
        ],
      });

      const result = computePendingNotifications(data);
      expect(result.length).toBe(0);
    });
  });

  // ─── Loan Overdue Reminders ───

  describe("loan overdue reminders", () => {
    it("creates notification for loan older than 4 weeks", () => {
      const data = makeData({
        games: [
          { id: 5, name: "Wingspan", lastPlayed: "2026-01-01", owned: true },
        ],
        loans: [
          {
            id: 1,
            gameId: 5,
            personName: "Max",
            loanDate: "2026-02-01",
            returnedAt: null,
          },
        ],
      });

      const result = computePendingNotifications(data);
      const loanNotifs = result.filter((n) => n.type === "loan-overdue");
      expect(loanNotifs.length).toBe(1);
      expect(loanNotifs[0].body).toContain("Wingspan");
      expect(loanNotifs[0].body).toContain("Max");
    });

    it("does NOT notify for recent loan", () => {
      const data = makeData({
        games: [
          { id: 5, name: "Wingspan", lastPlayed: null, owned: true },
        ],
        loans: [
          {
            id: 1,
            gameId: 5,
            personName: "Max",
            loanDate: "2026-03-10",
            returnedAt: null,
          },
        ],
      });

      const result = computePendingNotifications(data);
      const loanNotifs = result.filter((n) => n.type === "loan-overdue");
      expect(loanNotifs.length).toBe(0);
    });

    it("does NOT notify for returned loan", () => {
      const data = makeData({
        games: [
          { id: 5, name: "Wingspan", lastPlayed: null, owned: true },
        ],
        loans: [
          {
            id: 1,
            gameId: 5,
            personName: "Max",
            loanDate: "2026-01-01",
            returnedAt: "2026-02-15",
          },
        ],
      });

      const result = computePendingNotifications(data);
      const loanNotifs = result.filter((n) => n.type === "loan-overdue");
      expect(loanNotifs.length).toBe(0);
    });
  });

  // ─── Achievement Notification ───

  describe("achievement notifications", () => {
    it("creates achievement notification with correct data", () => {
      const notif = createAchievementNotification("Sammler", 42);
      expect(notif.type).toBe("achievement");
      expect(notif.title).toBe("Achievement freigeschaltet!");
      expect(notif.body).toContain("Sammler");
      expect(notif.id).toBe(400042);
    });
  });

  // ─── Notification IDs ───

  describe("notification IDs", () => {
    it("generates unique IDs per type and entity", () => {
      const data = makeData({
        games: [
          { id: 1, name: "A", lastPlayed: null, owned: true },
          { id: 2, name: "B", lastPlayed: null, owned: true },
        ],
      });

      const result = computePendingNotifications(data);
      const ids = result.map((n) => n.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  // ─── Combined Scenarios ───

  describe("combined notifications", () => {
    it("returns all notification types in one check", () => {
      const data = makeData({
        games: [
          { id: 1, name: "Catan", lastPlayed: null, owned: true },
          { id: 2, name: "Wingspan", lastPlayed: "2026-03-15", owned: true },
        ],
        gameNights: [
          { id: 1, name: "Spieleabend", date: "2026-03-20T19:00:00" },
        ],
        loans: [
          {
            id: 1,
            gameId: 2,
            personName: "Lisa",
            loanDate: "2026-01-15",
            returnedAt: null,
          },
        ],
      });

      const result = computePendingNotifications(data);
      const types = new Set(result.map((n) => n.type));
      expect(types.has("unplayed")).toBe(true);
      expect(types.has("game-night")).toBe(true);
      expect(types.has("loan-overdue")).toBe(true);
    });

    it("returns empty for no triggers", () => {
      const data = makeData({
        games: [
          { id: 1, name: "Catan", lastPlayed: "2026-03-18", owned: true },
        ],
        gameNights: [],
        loans: [],
      });

      const result = computePendingNotifications(data);
      expect(result.length).toBe(0);
    });
  });
});
