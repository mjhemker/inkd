/**
 * Global-search modal provider (mobile). Mounted once near the app root so any
 * screen's header search affordance can pop the search modal OVER the current
 * view — no navigation push, no dedicated route. Mirrors the web SearchProvider.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { SearchModal } from "@/components/search/SearchModal";

interface SearchModalValue {
  open: () => void;
  close: () => void;
  isOpen: boolean;
}

const SearchModalContext = createContext<SearchModalValue | null>(null);

/** Open/close the global search modal from any descendant. */
export function useSearchModal(): SearchModalValue {
  const ctx = useContext(SearchModalContext);
  if (!ctx) {
    // Degrade gracefully outside the provider (e.g. isolated previews).
    return { open: () => {}, close: () => {}, isOpen: false };
  }
  return ctx;
}

export function SearchModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const value = useMemo<SearchModalValue>(
    () => ({ isOpen, open: () => setIsOpen(true), close: () => setIsOpen(false) }),
    [isOpen],
  );
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <SearchModalContext.Provider value={value}>
      {children}
      <SearchModal open={isOpen} onClose={close} />
    </SearchModalContext.Provider>
  );
}
