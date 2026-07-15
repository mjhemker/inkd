/**
 * Placeholder Supabase `Database` type.
 *
 * This will be REPLACED by the generated types once the Supabase schema lands
 * (`supabase gen types typescript` → owned by the Supabase agent). Until then it
 * provides the shape `@supabase/supabase-js` expects so the client is typed.
 *
 * Do not hand-author real tables here — they belong in the generated file.
 */
export interface Database {
  public: {
    Tables: Record<
      string,
      {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: unknown[];
      }
    >;
    Views: Record<string, { Row: Record<string, unknown> }>;
    Functions: Record<string, unknown>;
    Enums: Record<string, unknown>;
    CompositeTypes: Record<string, unknown>;
  };
}

/** Convenience accessor for a table's Row type once real types are generated. */
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
