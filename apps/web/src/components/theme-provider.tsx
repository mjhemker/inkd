"use client";

/**
 * INKD web theme layer.
 *
 * Manages the Dark / Light / System appearance choice, persists it to
 * localStorage, and drives the `data-theme` attribute on <html> that the CSS
 * variable layer in globals.css keys off. The DEFAULT is DARK — a brand-new
 * visitor (no stored preference) boots into the near-black gallery.
 *
 * A tiny inline script in app/layout.tsx applies the resolved theme before
 * first paint (no flash); this provider then keeps it in sync on the client and
 * exposes `useTheme()` to the Appearance control and the /dev gallery toggle.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemePreference = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";

export const THEME_STORAGE_KEY = "inkd-theme";

/**
 * Inline, render-blocking script string. Injected in the document <head> so the
 * correct `data-theme` is on <html> before the first paint — no light-on-dark
 * flash. Kept dependency-free and defensive (private-mode / disabled storage).
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}')||'dark';var light=t==='light'||(t==='system'&&window.matchMedia('(prefers-color-scheme: light)').matches);document.documentElement.setAttribute('data-theme',light?'light':'dark');}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

interface ThemeContextValue {
  /** The user's chosen preference (Dark / Light / System). */
  preference: ThemePreference;
  /** The theme actually applied right now (System resolved against the OS). */
  resolved: ResolvedTheme;
  setPreference: (pref: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

function resolve(pref: ThemePreference): ResolvedTheme {
  return pref === "system" ? systemTheme() : pref;
}

function apply(theme: ResolvedTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Start from the DARK default; the inline script already set <html>, and the
  // mount effect reconciles with any stored preference.
  const [preference, setPref] = useState<ThemePreference>("dark");
  const [resolved, setResolved] = useState<ResolvedTheme>("dark");

  // Hydrate from storage on mount.
  useEffect(() => {
    let stored: ThemePreference = "dark";
    try {
      const raw = localStorage.getItem(THEME_STORAGE_KEY);
      if (raw === "light" || raw === "system" || raw === "dark") stored = raw;
    } catch {
      /* storage unavailable — keep the dark default */
    }
    setPref(stored);
    const next = resolve(stored);
    setResolved(next);
    apply(next);
  }, []);

  // When following the system, react to OS scheme changes live.
  useEffect(() => {
    if (preference !== "system" || typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => {
      const next = systemTheme();
      setResolved(next);
      apply(next);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [preference]);

  const setPreference = useCallback((pref: ThemePreference) => {
    setPref(pref);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, pref);
    } catch {
      /* ignore */
    }
    const next = resolve(pref);
    setResolved(next);
    apply(next);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within <ThemeProvider>");
  }
  return ctx;
}
