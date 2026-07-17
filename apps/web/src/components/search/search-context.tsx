"use client";

/**
 * Global-search context + the ⌘K/Ctrl+K keyboard shortcut. Mounted once by the
 * app shell so the top-bar search button (and the shortcut) can open the search
 * overlay from anywhere in the authenticated app.
 */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { SearchOverlay } from "./SearchOverlay";

interface SearchContextValue {
  open: () => void;
  close: () => void;
  isOpen: boolean;
}

const SearchContext = createContext<SearchContextValue | null>(null);

/** Open/close the global search overlay from any descendant. */
export function useGlobalSearchOverlay(): SearchContextValue {
  const ctx = useContext(SearchContext);
  if (!ctx) {
    // Degrade gracefully in harnesses that render a screen without the provider.
    return { open: () => {}, close: () => {}, isOpen: false };
  }
  return ctx;
}

export function SearchProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(e: globalThis.KeyboardEvent) {
      // ⌘K (mac) / Ctrl+K (win/linux) toggles the palette.
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setIsOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const value: SearchContextValue = {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
  };

  return (
    <SearchContext.Provider value={value}>
      {children}
      <SearchOverlay open={isOpen} onClose={() => setIsOpen(false)} />
    </SearchContext.Provider>
  );
}
