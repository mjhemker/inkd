// Shared CORS handling. The web + mobile clients call these functions via
// supabase.functions.invoke(), which issues a preflight OPTIONS for non-simple
// requests. Allow the standard Supabase headers.

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Returns a 204 preflight response when the request is an OPTIONS, else null. */
export function handlePreflight(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return null;
}
