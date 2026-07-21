import { useEffect } from "react";
import { Redirect } from "expo-router";
import { useSearchModal } from "@/providers/search";

/**
 * Legacy path alias. Global search is now a MODAL that pops over the current
 * view (see providers/search.tsx + components/search/SearchModal.tsx), not a
 * pushed screen. Any deep link to /search opens that modal over the feed rather
 * than navigating to a dedicated route.
 */
export default function SearchRedirect() {
  const { open } = useSearchModal();
  useEffect(() => {
    open();
  }, [open]);
  return <Redirect href="/(tabs)" />;
}
