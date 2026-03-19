/**
 * Backup Service — Export & Import collection data
 *
 * Exports all user data (games, players, groups, sessions, settings)
 * as a JSON backup file. Supports import with merge or replace modes.
 */

import { Preferences } from "@capacitor/preferences";
import type { Game, Player, PlayGroup, PlaySession, Loan } from "@/types/game";

export const BACKUP_VERSION = 3;

export interface BackupData {
  version: number;
  exportedAt: string;
  games: Game[];
  players: Player[];
  playGroups: PlayGroup[];
  playSessions: PlaySession[];
  loans: Loan[];
  settings: {
    language: string;
    theme: string;
  };
}

export interface BackupPreview {
  version: number;
  exportedAt: string;
  gameCount: number;
  playerCount: number;
  playGroupCount: number;
  sessionCount: number;
  loanCount: number;
}

/**
 * Create a backup object from current data + settings
 */
export async function createBackup(
  games: Game[],
  players: Player[],
  playGroups: PlayGroup[],
  playSessions: PlaySession[],
  loans: Loan[] = []
): Promise<BackupData> {
  const { value: language } = await Preferences.get({ key: "game_language" });
  const { value: theme } = await Preferences.get({ key: "theme_mode" });

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    games,
    players,
    playGroups,
    playSessions,
    loans,
    settings: {
      language: language || "de",
      theme: theme || "system",
    },
  };
}

/**
 * Generate the backup filename with current date
 */
export function getBackupFilename(): string {
  const date = new Date().toISOString().split("T")[0];
  return `what2play-backup-${date}.json`;
}

/**
 * Download a backup file via browser download
 */
export function downloadBackup(data: BackupData): void {
  const json = JSON.stringify(data, null, 2);
  const filename = getBackupFilename();
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Read a File object and return the text content
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Datei konnte nicht gelesen werden."));
    reader.readAsText(file);
  });
}

/**
 * Parse and validate a backup JSON string
 */
export function parseBackup(jsonString: string): BackupData {
  let data: BackupData;
  try {
    data = JSON.parse(jsonString);
  } catch {
    throw new Error("Ungültige Datei: Kein gültiges JSON-Format.");
  }

  if (!data || typeof data !== "object") {
    throw new Error("Ungültige Datei: Kein gültiges Backup-Format.");
  }

  if (!data.version || data.version > BACKUP_VERSION) {
    throw new Error(
      `Nicht unterstützte Backup-Version: ${data.version ?? "unbekannt"}. Bitte aktualisiere die App.`
    );
  }

  if (!Array.isArray(data.games)) {
    throw new Error("Ungültige Datei: Keine Spiele-Daten gefunden.");
  }

  // Ensure arrays exist
  data.players = Array.isArray(data.players) ? data.players : [];
  data.playGroups = Array.isArray(data.playGroups) ? data.playGroups : [];
  data.playSessions = Array.isArray(data.playSessions) ? data.playSessions : [];
  data.loans = Array.isArray(data.loans) ? data.loans : [];
  data.settings = data.settings || { language: "de", theme: "system" };

  return data;
}

/**
 * Get preview info from backup data
 */
export function getBackupPreview(data: BackupData): BackupPreview {
  return {
    version: data.version,
    exportedAt: data.exportedAt,
    gameCount: data.games.length,
    playerCount: data.players.length,
    playGroupCount: data.playGroups.length,
    sessionCount: data.playSessions.length,
    loanCount: data.loans?.length ?? 0,
  };
}
