/**
 * INKD mobile session provider.
 *
 * Wires the native Supabase client (from `@inkd/core/auth/mobile`) with
 * persistent storage, tracks the auth session reactively, and mounts the shared
 * `InkdProvider` so the TanStack Query hooks in `@inkd/core/hooks` work app-wide.
 *
 * MOUNTING: this file intentionally does NOT touch `app/_layout.tsx` (owned by
 * the design agent). Wrap the router tree with <SessionProvider> there, e.g.:
 *
 *   import { SessionProvider } from "@/providers/session";
 *   // inside RootLayout, wrap the <Stack/>:
 *   <SessionProvider>
 *     <Stack ... />
 *   </SessionProvider>
 *
 * It must sit ABOVE any screen that reads auth state or uses the core hooks, and
 * below <SafeAreaProvider> is fine.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import type { Session, User } from "@supabase/supabase-js";
import {
  createNativeSupabaseClient,
  type SupabaseStorageAdapter,
} from "@inkd/core/auth/mobile";
import { signOut as coreSignOut } from "@inkd/core/auth";
import { InkdProvider } from "@inkd/core/hooks";
import type { InkdSupabaseClient } from "@inkd/core/supabase";

/**
 * SecureStore-backed adapter (opt-in). SecureStore caps values at ~2KB, so the
 * session string is chunked across numbered keys. Provides at-rest encryption of
 * the refresh token via the platform keystore/keychain.
 */
const CHUNK_SIZE = 1800;
export const secureStorageAdapter: SupabaseStorageAdapter = {
  async getItem(key) {
    const meta = await SecureStore.getItemAsync(`${key}__chunks`);
    if (meta == null) return SecureStore.getItemAsync(key);
    const count = Number(meta);
    let out = "";
    for (let i = 0; i < count; i++) {
      const part = await SecureStore.getItemAsync(`${key}__${i}`);
      if (part == null) return null;
      out += part;
    }
    return out;
  },
  async setItem(key, value) {
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.deleteItemAsync(`${key}__chunks`);
      await SecureStore.setItemAsync(key, value);
      return;
    }
    const chunks = Math.ceil(value.length / CHUNK_SIZE);
    await SecureStore.setItemAsync(`${key}__chunks`, String(chunks));
    for (let i = 0; i < chunks; i++) {
      await SecureStore.setItemAsync(
        `${key}__${i}`,
        value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
      );
    }
  },
  async removeItem(key) {
    const meta = await SecureStore.getItemAsync(`${key}__chunks`);
    if (meta != null) {
      const count = Number(meta);
      for (let i = 0; i < count; i++) {
        await SecureStore.deleteItemAsync(`${key}__${i}`);
      }
      await SecureStore.deleteItemAsync(`${key}__chunks`);
    }
    await SecureStore.deleteItemAsync(key);
  },
};

/** Default storage: AsyncStorage (recommended by Supabase for Expo; ample size,
 * fast). Swap `storage={secureStorageAdapter}` on <SessionProvider> for keystore
 * encryption if your threat model needs it. */
const defaultStorage: SupabaseStorageAdapter = AsyncStorage;

interface SessionContextValue {
  supabase: InkdSupabaseClient;
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export interface SessionProviderProps {
  children: ReactNode;
  /** Override the session storage (defaults to AsyncStorage). */
  storage?: SupabaseStorageAdapter;
}

export function SessionProvider({ children, storage }: SessionProviderProps) {
  const supabase = useMemo(
    () => createNativeSupabaseClient({ storage: storage ?? defaultStorage }),
    [storage],
  );
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const appStateBound = useRef(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setIsLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setIsLoading(false);
    });

    // Pause/resume auto-refresh with app foreground state (Supabase guidance).
    if (!appStateBound.current) {
      appStateBound.current = true;
      AppState.addEventListener("change", (state) => {
        if (state === "active") supabase.auth.startAutoRefresh();
        else supabase.auth.stopAutoRefresh();
      });
    }

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  const value = useMemo<SessionContextValue>(
    () => ({
      supabase,
      session,
      user: session?.user ?? null,
      isLoading,
      signOut: async () => {
        await coreSignOut(supabase);
      },
    }),
    [supabase, session, isLoading],
  );

  return (
    <SessionContext.Provider value={value}>
      <InkdProvider client={supabase}>{children}</InkdProvider>
    </SessionContext.Provider>
  );
}

/** Access the mobile session (client, session, user, signOut). */
export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within a <SessionProvider>");
  }
  return ctx;
}
