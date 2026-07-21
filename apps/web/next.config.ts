import type { NextConfig } from "next";

/**
 * Founder's promo/marketing site — a SEPARATE repo/project, deployed on its
 * own at https://inkd-landing.vercel.app. It is proxied under the app's
 * domain at /marketing so getinkd.co can host it without merging repos or
 * moving the domain to the landing project.
 *
 * This is unrelated to /preview, which is this app's own internal marketing
 * page (see docs/deployment.md §0) — both are kept, per the founder's ask.
 *
 * CAVEAT — static assets: this rewrite only proxies HTML *page* requests
 * (/marketing and /marketing/*). A stock Next.js build on the landing side
 * emits its JS/CSS/image assets at root-absolute paths (e.g.
 * /_next/static/..., /favicon.ico) rather than paths prefixed with
 * /marketing. Those root-absolute asset requests are NOT covered by this
 * rewrite (they don't start with /marketing) and will hit the getinkd.co app
 * instead of inkd-landing, 404ing there. Egress to inkd-landing.vercel.app
 * was blocked in this environment (proxy denied CONNECT), so its actual
 * asset paths could not be inspected directly to confirm.
 *
 * Fix (in the inkd-landing repo, not here): set `basePath: "/marketing"` (and
 * `assetPrefix` if using a separate asset CDN) in that project's
 * next.config so its own build emits every asset under /marketing/_next/...
 * etc. — then this rewrite's :path* passthrough covers assets too. See
 * docs/deployment.md for the full explanation and verification steps.
 */
const LANDING_ORIGIN = "https://inkd-landing.vercel.app";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Transpile the workspace packages that ship TypeScript / raw source.
  transpilePackages: ["@inkd/core", "@inkd/ui"],
  async rewrites() {
    return [
      // Bare /marketing (no trailing slash) -> landing root.
      { source: "/marketing", destination: `${LANDING_ORIGIN}/` },
      // /marketing/ and every subpath -> the same path on the landing origin.
      { source: "/marketing/:path*", destination: `${LANDING_ORIGIN}/:path*` },
    ];
  },
};

export default nextConfig;
