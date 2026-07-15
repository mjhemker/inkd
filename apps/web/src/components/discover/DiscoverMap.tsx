"use client";

/**
 * The discovery map (web). MapLibre GL JS with a KEYLESS tile source.
 *
 * TILE SOURCE — OpenFreeMap (https://openfreemap.org), the "positron" vector
 * style at https://tiles.openfreemap.org/styles/positron. Chosen because it is
 * genuinely keyless (no token, no sign-up, self-hostable) and the pilot needs
 * zero external account setup. Positron is a light, low-chroma basemap; we lay
 * a subtle dark treatment over the GL canvas (CSS filter) so it reads on the
 * near-black INKD canvas without shipping a custom style JSON. OpenFreeMap has
 * no usage limits for reasonable use.
 * LICENSING: map data © OpenStreetMap contributors (ODbL 1.0); the OpenFreeMap
 * styles/tiles are free to use. Attribution is rendered in the map corner.
 *
 * Pins are square violet placards; artists with active flash burn ember.
 * Points cluster at low zoom; clicking a cluster zooms in, clicking a pin opens
 * a placard popover linking to /a/[handle]. On every move we report which pins
 * are in view so the list stays synced to the viewport.
 */
import { useEffect, useRef, useState } from "react";
import maplibregl, {
  type GeoJSONSource,
  type LngLatBoundsLike,
  type MapGeoJSONFeature,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { Icon } from "@inkd/ui/web";
import { formatMinPrice, formatDistanceMiles, type ArtistCard } from "@inkd/core/api";

const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
const SOURCE_ID = "artists";
const VIOLET = "#7C3AED";
const EMBER = "#E8A15C";
const INK = "#0A0A0B";

export interface DiscoverMapProps {
  cards: ArtistCard[];
  center: { lat: number; lng: number } | null;
  activeId: string | null;
  onHoverPin?: (artistId: string | null) => void;
  onVisibleChange?: (artistIds: string[]) => void;
  className?: string;
}

function toFeatureCollection(cards: ArtistCard[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: cards
      .filter((c) => c.lat != null && c.lng != null)
      .map((c) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [c.lng as number, c.lat as number] },
        properties: {
          id: c.artist_id,
          handle: c.handle,
          name: c.display_name,
          flash: c.has_active_flash,
          books_open: c.books_open,
          price: formatMinPrice(c.min_price_cents) ?? "",
          city: [c.city, c.state].filter(Boolean).join(", "),
          distance: c.distance_km != null ? formatDistanceMiles(c.distance_km) : "",
        },
      })),
  };
}

/** Build a square "placard" pin as an addImage-ready RGBA bitmap. */
function makePin(fill: string): { width: number; height: number; data: Uint8Array } | null {
  const size = 40;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const pad = 7;
  ctx.fillStyle = INK;
  ctx.fillRect(pad - 2, pad - 2, size - 2 * (pad - 2), size - 2 * (pad - 2));
  ctx.fillStyle = fill;
  ctx.fillRect(pad, pad, size - 2 * pad, size - 2 * pad);
  const img = ctx.getImageData(0, 0, size, size);
  return { width: size, height: size, data: new Uint8Array(img.data.buffer) };
}

export function DiscoverMap({
  cards,
  center,
  onHoverPin,
  onVisibleChange,
  className,
}: DiscoverMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const onVisibleRef = useRef(onVisibleChange);
  const onHoverRef = useRef(onHoverPin);
  onVisibleRef.current = onVisibleChange;
  onHoverRef.current = onHoverPin;
  // "loading" until the basemap style loads; "error" if tiles never arrive
  // (keyless OpenFreeMap down / offline) so we can show an honest placard
  // instead of a blank gray canvas; "ready" once the map paints.
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  // Init once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: center ? [center.lng, center.lat] : [-76.2, 39.6],
      zoom: center ? 10 : 7,
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    // If the basemap style hasn't loaded within a reasonable window, treat the
    // tiles as unavailable and fall back to the placard (the list still works).
    const loadTimeout = setTimeout(() => {
      if (!readyRef.current) setStatus("error");
    }, 8000);
    // A hard style-load failure (not a single dropped tile) → error immediately.
    map.on("error", (e) => {
      if (!readyRef.current && !map.isStyleLoaded()) {
        setStatus("error");
      }
      // Surface the underlying reason for debugging without blanking on
      // transient per-tile fetch errors once the map is already up.
      if (e?.error) console.warn("DiscoverMap tile/source error:", e.error.message);
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    const reportVisible = () => {
      if (!onVisibleRef.current) return;
      const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      if (!src) return;
      const bounds = map.getBounds();
      const feats = map.querySourceFeatures(SOURCE_ID);
      const ids = new Set<string>();
      for (const f of feats) {
        const [lng, lat] = (f.geometry as GeoJSON.Point).coordinates as [number, number];
        if (!f.properties?.cluster && bounds.contains([lng, lat])) {
          ids.add(String(f.properties?.id));
        }
      }
      onVisibleRef.current([...ids]);
    };

    map.on("load", () => {
      const violet = makePin(VIOLET);
      const ember = makePin(EMBER);
      if (violet && !map.hasImage("pin-violet")) map.addImage("pin-violet", violet);
      if (ember && !map.hasImage("pin-ember")) map.addImage("pin-ember", ember);

      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: toFeatureCollection(cards),
        cluster: true,
        clusterRadius: 44,
        clusterMaxZoom: 12,
      });

      map.addLayer({
        id: "clusters",
        type: "circle",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": VIOLET,
          "circle-radius": ["step", ["get", "point_count"], 16, 5, 22, 15, 28],
          "circle-stroke-width": 2,
          "circle-stroke-color": INK,
        },
      });
      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-font": ["Noto Sans Bold"],
          "text-size": 13,
        },
        paint: { "text-color": "#FFFFFF" },
      });
      map.addLayer({
        id: "unclustered",
        type: "symbol",
        source: SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        layout: {
          "icon-image": ["case", ["get", "flash"], "pin-ember", "pin-violet"],
          "icon-size": 0.6,
          "icon-allow-overlap": true,
        },
      });

      map.on("click", "clusters", (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ["clusters"] });
        const clusterId = features[0]?.properties?.cluster_id;
        const src = map.getSource(SOURCE_ID) as GeoJSONSource;
        if (clusterId == null) return;
        const feat = features[0];
        if (!feat) return;
        void src.getClusterExpansionZoom(clusterId).then((zoom) => {
          const [lng, lat] = (feat.geometry as GeoJSON.Point).coordinates as [number, number];
          map.easeTo({ center: [lng, lat], zoom });
        });
      });

      map.on("click", "unclustered", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        openPopup(map, f, popupRef);
      });
      map.on("mouseenter", "unclustered", (e) => {
        map.getCanvas().style.cursor = "pointer";
        onHoverRef.current?.(String(e.features?.[0]?.properties?.id));
      });
      map.on("mouseleave", "unclustered", () => {
        map.getCanvas().style.cursor = "";
        onHoverRef.current?.(null);
      });
      map.on("mouseenter", "clusters", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "clusters", () => (map.getCanvas().style.cursor = ""));

      readyRef.current = true;
      clearTimeout(loadTimeout);
      setStatus("ready");
      reportVisible();
      fitToCards(map, cards, center);
    });

    map.on("moveend", reportVisible);

    return () => {
      clearTimeout(loadTimeout);
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
  }, []);

  // Push new results into the source when cards change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    if (src) {
      src.setData(toFeatureCollection(cards));
      fitToCards(map, cards, center);
    }
  }, [cards]);

  // Recenter when the search center changes (city quick-pick / geolocation).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current || !center) return;
    map.easeTo({ center: [center.lng, center.lat], zoom: Math.max(map.getZoom(), 10) });
  }, [center?.lat, center?.lng]);

  const pinCount = cards.filter((c) => c.lat != null && c.lng != null).length;

  return (
    <div className={`relative ${className ?? ""}`}>
      <div
        ref={containerRef}
        className="h-full w-full"
        style={{ filter: "brightness(0.82) invert(0.92) hue-rotate(185deg) saturate(0.85) contrast(0.95)" }}
      />

      {/* Loading — skeleton pins over a tinted plate until the basemap paints. */}
      {status === "loading" && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-surface-base/80">
          <div className="flex flex-col items-center gap-3">
            <div className="flex gap-2">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-6 w-6 animate-pulse rounded-[3px] bg-surface-overlay"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-content-muted">
              Loading map
            </span>
          </div>
        </div>
      )}

      {/* Tiles unavailable — honest placard, the list still covers the results. */}
      {status === "error" && (
        <div className="absolute inset-0 grid place-items-center bg-surface-base p-6">
          <div className="max-w-xs border border-border-subtle bg-surface-raised p-5 text-center">
            <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-[3px] bg-surface-overlay text-content-muted">
              <Icon name="map-pin" size={20} />
            </div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-content-muted">
              Map unavailable
            </p>
            <p className="mt-1.5 text-sm text-content-secondary">
              Map tiles couldn&apos;t load — the list has you covered.
            </p>
          </div>
        </div>
      )}

      {/* Ready but nothing to plot — subtle honest note over the basemap. */}
      {status === "ready" && pinCount === 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
          <span className="rounded-full border border-border-subtle bg-surface-base/90 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-content-muted">
            No artists in this area
          </span>
        </div>
      )}
    </div>
  );
}

function fitToCards(
  map: maplibregl.Map,
  cards: ArtistCard[],
  center: { lat: number; lng: number } | null,
) {
  const pts = cards.filter((c) => c.lat != null && c.lng != null);
  if (pts.length === 0) return;
  const first = pts[0];
  if (pts.length === 1 && !center && first) {
    map.easeTo({ center: [first.lng as number, first.lat as number], zoom: 11 });
    return;
  }
  const bounds = new maplibregl.LngLatBounds();
  for (const c of pts) bounds.extend([c.lng as number, c.lat as number]);
  if (center) bounds.extend([center.lng, center.lat]);
  map.fitBounds(bounds as LngLatBoundsLike, { padding: 64, maxZoom: 13, duration: 400 });
}

function openPopup(
  map: maplibregl.Map,
  f: MapGeoJSONFeature,
  popupRef: React.MutableRefObject<maplibregl.Popup | null>,
) {
  const p = f.properties ?? {};
  const coords = (f.geometry as GeoJSON.Point).coordinates.slice() as [number, number];
  const price = p.price ? `<span style="color:${EMBER};font-weight:700">from ${p.price}</span>` : "";
  const stamp = p.books_open
    ? `<span style="background:${VIOLET};color:#fff;font-size:9px;letter-spacing:.12em;font-weight:700;text-transform:uppercase;padding:2px 6px;border-radius:2px">Books open</span>`
    : `<span style="border:1px solid #3F3F46;color:#A1A1AA;font-size:9px;letter-spacing:.12em;font-weight:700;text-transform:uppercase;padding:2px 6px;border-radius:2px">Books closed</span>`;
  const html = `
    <div style="min-width:180px;font-family:ui-sans-serif,system-ui">
      <div style="font-weight:700;font-size:15px;color:#0A0A0B">${escapeHtml(String(p.name ?? ""))}</div>
      <div style="font-size:11px;color:#52525B;margin-top:1px">${escapeHtml(String(p.city ?? ""))}${p.distance ? " · " + escapeHtml(String(p.distance)) : ""}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px">
        ${stamp}${price}
      </div>
      <a href="/a/${encodeURIComponent(String(p.handle ?? ""))}" style="display:block;margin-top:10px;text-align:center;background:${VIOLET};color:#fff;font-size:12px;font-weight:600;padding:6px 10px;border-radius:3px;text-decoration:none">View profile</a>
    </div>`;
  popupRef.current?.remove();
  popupRef.current = new maplibregl.Popup({ offset: 14, closeButton: true, maxWidth: "240px" })
    .setLngLat(coords)
    .setHTML(html)
    .addTo(map);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}
