/** Centralized TanStack Query key factory — stable, hierarchical, typo-proof. */
export const queryKeys = {
  currentProfile: () => ["currentProfile"] as const,
  profile: (id: string) => ["profile", id] as const,
  artistProfile: (id: string) => ["artistProfile", id] as const,
  services: (artistId: string) => ["services", artistId] as const,
  availabilityRules: (artistId: string) =>
    ["availabilityRules", artistId] as const,
  availabilityBlocks: (artistId: string) =>
    ["availabilityBlocks", artistId] as const,
  bookingPolicy: (artistId: string) => ["bookingPolicy", artistId] as const,
  artistBookingRequests: (artistId: string, status?: string) =>
    ["bookingRequests", "artist", artistId, status ?? "all"] as const,
  clientBookingRequests: (clientId: string) =>
    ["bookingRequests", "client", clientId] as const,
  threadMessages: (threadId: string) => ["messages", threadId] as const,
  notifications: (profileId: string) => ["notifications", profileId] as const,
  artistPayments: (artistId: string) => ["payments", "artist", artistId] as const,
  artistEarnings: (artistId: string) => ["earnings", artistId] as const,
  sessionPayments: (sessionId: string) =>
    ["payments", "session", sessionId] as const,
  connectStatus: (artistId: string) => ["connectStatus", artistId] as const,
} as const;
