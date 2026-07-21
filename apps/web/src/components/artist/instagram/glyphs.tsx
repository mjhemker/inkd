/**
 * Small inline SVG glyphs the shared Icon set doesn't ship (Instagram mark,
 * external-link, video/play, carousel-stack). Kept tiny + currentColor so they
 * inherit the placard/stamp ink like the rest of the design language.
 */
import type { SVGProps } from "react";

function base(props: SVGProps<SVGSVGElement>, size: number) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...props,
  };
}

export function InstagramGlyph({ size = 16, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg {...base(props, size)}>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

export function ExternalLinkGlyph({ size = 14, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg {...base(props, size)}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

export function VideoGlyph({ size = 14, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg {...base(props, size)}>
      <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function CarouselGlyph({ size = 14, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg {...base(props, size)}>
      <rect x="7" y="7" width="14" height="14" rx="2" />
      <path d="M3 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}
