/**
 * React context that supplies the INKD Supabase client (and a QueryClient) to
 * the TanStack Query hooks. Platform-agnostic: mount it in the Next.js root
 * layout (Client Component boundary) and in the Expo session provider.
 */
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

import type { InkdSupabaseClient } from "../supabase/client";

const ClientContext = createContext<InkdSupabaseClient | null>(null);

export interface InkdProviderProps {
  /** The platform's Supabase client (web ssr browser client or native client). */
  client: InkdSupabaseClient;
  /** Optional shared QueryClient; one is created if omitted. */
  queryClient?: QueryClient;
  children: ReactNode;
}

/** Wraps the app with the Supabase client + a TanStack QueryClient. */
export function InkdProvider({
  client,
  queryClient,
  children,
}: InkdProviderProps) {
  const [defaultQueryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );
  const qc = queryClient ?? defaultQueryClient;
  const value = useMemo(() => client, [client]);
  return (
    <ClientContext.Provider value={value}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </ClientContext.Provider>
  );
}

/** Access the INKD Supabase client from any component under `InkdProvider`. */
export function useInkdClient(): InkdSupabaseClient {
  const client = useContext(ClientContext);
  if (!client) {
    throw new Error("useInkdClient must be used within an <InkdProvider>");
  }
  return client;
}
