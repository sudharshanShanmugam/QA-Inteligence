"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

type Mode = "light" | "dark";

interface ThemeModeCtxValue {
  mode: Mode;
  toggle: () => void;
}

const ThemeModeCtx = createContext<ThemeModeCtxValue>({ mode: "light", toggle: () => {} });

export function ThemeModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>("light");

  useEffect(() => {
    const saved = localStorage.getItem("qa-theme-mode") as Mode | null;
    if (saved === "dark" || saved === "light") setMode(saved);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", mode);
    document.documentElement.style.colorScheme = mode;
    localStorage.setItem("qa-theme-mode", mode);
  }, [mode]);

  const toggle = useCallback(() => setMode((m) => (m === "light" ? "dark" : "light")), []);

  return (
    <ThemeModeCtx.Provider value={{ mode, toggle }}>
      {children}
    </ThemeModeCtx.Provider>
  );
}

export function useThemeMode() {
  return useContext(ThemeModeCtx);
}
