"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getThemeMode, setThemeMode, resolveTheme } from "@/services/theme";
import type { ThemeMode } from "@/services/theme";

interface ThemeContextValue {
  mode: ThemeMode;
  resolved: "light" | "dark";
  setMode: (mode: ThemeMode) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: "system",
  resolved: "light",
  setMode: async () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");
  const [loaded, setLoaded] = useState(false);

  // Apply theme class to <html> with smooth transition
  const applyTheme = useCallback((resolvedTheme: "light" | "dark", animate = false) => {
    const root = document.documentElement;
    if (animate) {
      root.classList.add("theme-transition");
      requestAnimationFrame(() => {
        root.classList.toggle("dark", resolvedTheme === "dark");
      });
      setTimeout(() => root.classList.remove("theme-transition"), 350);
    } else {
      root.classList.toggle("dark", resolvedTheme === "dark");
    }
    // Update meta theme-color for mobile browsers
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute("content", resolvedTheme === "dark" ? "#121110" : "#F8F6F1");
    }
  }, []);

  // Load saved preference
  useEffect(() => {
    getThemeMode().then((savedMode) => {
      setModeState(savedMode);
      const r = resolveTheme(savedMode);
      setResolved(r);
      applyTheme(r);
      setLoaded(true);
    });
  }, [applyTheme]);

  // Listen for system preference changes
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (mode === "system") {
        const r = resolveTheme("system");
        setResolved(r);
        applyTheme(r);
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode, applyTheme]);

  const handleSetMode = useCallback(
    async (newMode: ThemeMode) => {
      setModeState(newMode);
      const r = resolveTheme(newMode);
      setResolved(r);
      applyTheme(r, true); // animate the transition
      await setThemeMode(newMode);
    },
    [applyTheme],
  );

  // Prevent flash of wrong theme — render nothing until loaded
  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={{ mode, resolved, setMode: handleSetMode }}>
      {children}
    </ThemeContext.Provider>
  );
}
