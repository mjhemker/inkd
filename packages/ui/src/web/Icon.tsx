import type { ReactNode } from "react";

export type IconName =
  | "home"
  | "compass"
  | "calendar"
  | "message-circle"
  | "user"
  | "layout-grid"
  | "settings"
  | "search"
  | "bell"
  | "plus"
  | "check"
  | "x"
  | "chevron-down"
  | "chevron-right"
  | "chevron-left"
  | "arrow-right"
  | "map-pin"
  | "star"
  | "image"
  | "sparkles"
  | "menu"
  | "credit-card"
  | "clock"
  | "shield"
  | "trending-up";

export interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

const paths: Record<IconName, () => ReactNode> = {
  home: () => (
    <>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M9.5 20v-6h5v6" />
    </>
  ),
  compass: () => (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
    </>
  ),
  calendar: () => (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17" />
      <path d="M8 3v4M16 3v4" />
    </>
  ),
  "message-circle": () => (
    <path d="M21 12a8.5 8.5 0 1 1-3.6-6.94L21 4l-1.06 3.4c.68 1.25 1.06 2.68 1.06 4.6Z" />
  ),
  user: () => (
    <>
      <circle cx="12" cy="8" r="3.75" />
      <path d="M4.5 20c1.4-3.6 4.3-5.5 7.5-5.5s6.1 1.9 7.5 5.5" />
    </>
  ),
  "layout-grid": () => (
    <>
      <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13" y="3.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="3.5" y="13" width="7.5" height="7.5" rx="1.5" />
      <rect x="13" y="13" width="7.5" height="7.5" rx="1.5" />
    </>
  ),
  settings: () => (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2M17.66 6.34l-1.42 1.42M7.76 16.24l-1.42 1.42M17.66 17.66l-1.42-1.42M7.76 7.76 6.34 6.34" />
    </>
  ),
  search: () => (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m20 20-4.5-4.5" />
    </>
  ),
  bell: () => (
    <>
      <path d="M6 9.5a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13.5 6 9.5Z" />
      <path d="M10 18.5a2 2 0 0 0 4 0" />
    </>
  ),
  plus: () => <path d="M12 5v14M5 12h14" />,
  check: () => <path d="M5 13l4.5 4.5L19 8" />,
  x: () => <path d="M6 6l12 12M18 6 6 18" />,
  "chevron-down": () => <path d="m6 9 6 6 6-6" />,
  "chevron-right": () => <path d="m9 6 6 6-6 6" />,
  "chevron-left": () => <path d="m15 6-6 6 6 6" />,
  "arrow-right": () => <path d="M4 12h16M13 5l7 7-7 7" />,
  "map-pin": () => (
    <>
      <path d="M12 21.5s7-6.6 7-12a7 7 0 1 0-14 0c0 5.4 7 12 7 12Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  star: () => (
    <path d="m12 3.5 2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6-4.4-4.2 6-.8L12 3.5Z" />
  ),
  image: () => (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <circle cx="9" cy="10" r="1.75" />
      <path d="m5 18 5-5 3 3 3-4 3.5 6" />
    </>
  ),
  sparkles: () => (
    <>
      <path d="M12 3.5 13.4 8l4.5 1.4-4.5 1.4L12 15.3 10.6 10.8 6.1 9.4l4.5-1.4L12 3.5Z" />
      <path d="M18.5 15v3.5M17 16.75h3" />
    </>
  ),
  menu: () => <path d="M4 7h16M4 12h16M4 17h16" />,
  "credit-card": () => (
    <>
      <rect x="3" y="6" width="18" height="12.5" rx="2" />
      <path d="M3 10.5h18" />
      <path d="M6.5 15h3" />
    </>
  ),
  clock: () => (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  shield: () => (
    <path d="M12 3.5 19 6.5v5c0 5-3 8.4-7 9.5-4-1.1-7-4.5-7-9.5v-5L12 3.5Z" />
  ),
  "trending-up": () => (
    <>
      <path d="m3.5 16.5 6-6 4 4 7-7.5" />
      <path d="M15 6.5h5.5V12" />
    </>
  ),
};

export function Icon({
  name,
  size = 20,
  strokeWidth = 1.75,
  className,
}: IconProps) {
  const Shape = paths[name];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {Shape()}
    </svg>
  );
}
