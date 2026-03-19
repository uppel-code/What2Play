/**
 * Theme Service — Dark mode preference management
 *
 * Uses Capacitor Preferences for cross-platform persistence.
 * Supports: "light", "dark", "system"
 */

import { Preferences } from "@capacitor/preferences";

export type ThemeMode = "light" | "dark" | "system";

const THEME_KEY = "theme_mode";

export async function getThemeMode(): Promise<ThemeMode> {
  const { value } = await Preferences.get({ key: THEME_KEY });
  if (value === "light" || value === "dark" || value === "system") return value;
  return "system";
}

export async function setThemeMode(mode: ThemeMode): Promise<void> {
  await Preferences.set({ key: THEME_KEY, value: mode });
}

/**
 * Resolve the effective theme (light or dark) based on mode + system preference.
 */
export function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "light" || mode === "dark") return mode;
  if (typeof window !== "undefined") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return "light";
}
