/**
 * INKD mobile theme layer.
 *
 * Owns the Dark / Light / System appearance choice, persists it to
 * AsyncStorage, and drives NativeWind's color scheme (class-based `dark`
 * variant) so the semantic CSS variables in global.css re-skin every
 * className-styled surface. The DEFAULT is DARK — the provider forces the dark
 * scheme on first launch unless a stored preference (or System) says otherwise.
 *
 * `useTheme()` also exposes the resolved semantic palette (`colors`) so screens
 * that must pass concrete colors to JS props — the tab bar, StatusBar, native
 * icon glyph colors — stay in sync with the active theme.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "nativewind";
import AsyncStorage from "@react-native-async-storage/async-storage";
import tokens from "@inkd/ui/tokens";
import type { SemanticColors } from "@inkd/ui/tokens";

export type ThemePreference = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";

const STORAGE_KEY = "inkd-theme";

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (pref: ThemePreference) => void;
  /** The active theme's semantic palette, for JS style props. */
  colors: SemanticColors;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { colorScheme, setColorScheme } = useColorScheme();
  const [preference, setPref] = useState<ThemePreference>("dark");
  const hydrated = useRef(false);

  // Force the DARK default immediately, then reconcile with any stored choice.
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    setColorScheme("dark");
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw === "light" || raw === "dark" || raw === "system") {
          setPref(raw);
          setColorScheme(raw);
        }
      } catch {
        /* storage unavailable — keep the dark default */
      }
    })();
  }, [setColorScheme]);

  const setPreference = useCallback(
    (pref: ThemePreference) => {
      setPref(pref);
      setColorScheme(pref);
      void AsyncStorage.setItem(STORAGE_KEY, pref).catch(() => {});
    },
    [setColorScheme],
  );

  // NativeWind resolves "system" to a concrete scheme; fall back to dark.
  const resolved: ResolvedTheme = colorScheme === "light" ? "light" : "dark";

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      resolved,
      setPreference,
      colors: tokens.colors.themes[resolved],
    }),
    [preference, resolved, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>");
  return ctx;
}
