/**
 * Map style resolution + Mapbox URL rewriting for the discovery map.
 *
 * Pure and framework-free so it can be unit-tested without a DOM or MapLibre
 * (the sandbox can't render tiles). DiscoverMap consumes `resolveMapStyles` to
 * get an ordered fallback chain and `makeMapboxTransformRequest` to make
 * `mapbox://` styles work under MapLibre with a plain Mapbox token.
 *
 * Fallback order (first that actually paints tiles wins; each is tried in turn):
 *   1. NEXT_PUBLIC_MAP_STYLE_URL         — operator override (MapTiler, Mapbox,
 *                                          self-hosted…). If it is a mapbox://
 *                                          URL and a token is present, it is
 *                                          wired with the Mapbox transform.
 *   2. mapbox://styles/mapbox/dark-v11   — only when NEXT_PUBLIC_MAPBOX_TOKEN is
 *                                          set and no explicit style URL.
 *   3. OpenFreeMap "liberty"             — keyless, no signup.
 *   4. OpenFreeMap "positron"            — keyless, lighter fallback.
 * If every candidate fails at runtime the map shows an honest placard.
 */

/** A MapLibre-compatible request transform. Kept local to avoid a maplibre import. */
export type RequestTransform = (
  url: string,
  resourceType?: string,
) => { url: string } | undefined;

export interface StyleCandidate {
  /** Stable id for logging ("override" | "mapbox" | "openfreemap-liberty" | …). */
  id: string;
  /** The style URL passed to `new maplibregl.Map({ style })`. */
  url: string;
  /** Present only for mapbox:// styles: rewrites mapbox:// → api.mapbox.com. */
  transformRequest?: RequestTransform;
}

export const OPENFREEMAP_LIBERTY = "https://tiles.openfreemap.org/styles/liberty";
export const OPENFREEMAP_POSITRON = "https://tiles.openfreemap.org/styles/positron";
export const DEFAULT_MAPBOX_STYLE = "mapbox://styles/mapbox/dark-v11";

export interface MapStyleEnv {
  styleUrl?: string | null;
  mapboxToken?: string | null;
}

/**
 * Rewrite a `mapbox://` resource URL to its `api.mapbox.com` HTTPS equivalent,
 * appending the access token. Handles style JSON, sprites (incl. @2x + format),
 * glyph fonts, and tileset ids (→ TileJSON). Non-mapbox URLs pass through the
 * caller unchanged, so this is only invoked for mapbox:// inputs.
 */
export function rewriteMapboxUrl(url: string, token: string): string {
  const withToken = (u: string) => u + (u.includes("?") ? "&" : "?") + "access_token=" + token;

  if (url.startsWith("mapbox://styles/")) {
    return withToken("https://api.mapbox.com/styles/v1/" + url.slice("mapbox://styles/".length));
  }
  if (url.startsWith("mapbox://fonts/")) {
    return withToken("https://api.mapbox.com/fonts/v1/" + url.slice("mapbox://fonts/".length));
  }
  if (url.startsWith("mapbox://sprites/")) {
    // e.g. mapbox://sprites/mapbox/dark-v11.json | ...@2x.png
    const rest = url.slice("mapbox://sprites/".length);
    const m = rest.match(/^([^/]+)\/(.+?)(@\d+x)?\.(\w+)$/);
    if (m) {
      const [, user, styleId, ratio = "", ext] = m;
      return withToken(`https://api.mapbox.com/styles/v1/${user}/${styleId}/sprite${ratio}.${ext}`);
    }
    // Unusual shape — best-effort passthrough with token.
    return withToken("https://api.mapbox.com/styles/v1/" + rest);
  }
  // Anything else is a tileset id → TileJSON. The returned TileJSON already
  // carries token-bearing tile URLs, so tile requests need no further rewrite.
  return withToken("https://api.mapbox.com/v4/" + url.slice("mapbox://".length) + ".json") + "&secure";
}

/** Build a MapLibre `transformRequest` that resolves mapbox:// URLs with a token. */
export function makeMapboxTransformRequest(token: string): RequestTransform {
  return (url) => {
    if (url.startsWith("mapbox://")) return { url: rewriteMapboxUrl(url, token) };
    return { url };
  };
}

/** Resolve the ordered style fallback chain from env. Never empty. */
export function resolveMapStyles(env: MapStyleEnv = {}): StyleCandidate[] {
  const styleUrl = env.styleUrl?.trim() || "";
  const token = env.mapboxToken?.trim() || "";
  const candidates: StyleCandidate[] = [];

  if (styleUrl) {
    const isMapbox = styleUrl.startsWith("mapbox://");
    candidates.push({
      id: "override",
      url: styleUrl,
      transformRequest: isMapbox && token ? makeMapboxTransformRequest(token) : undefined,
    });
  } else if (token) {
    candidates.push({
      id: "mapbox",
      url: DEFAULT_MAPBOX_STYLE,
      transformRequest: makeMapboxTransformRequest(token),
    });
  }

  // Keyless fallbacks are always appended so a failed override still degrades
  // to a working basemap before the honest "map unavailable" placard.
  candidates.push({ id: "openfreemap-liberty", url: OPENFREEMAP_LIBERTY });
  candidates.push({ id: "openfreemap-positron", url: OPENFREEMAP_POSITRON });
  return candidates;
}
