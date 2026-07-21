/**
 * Pure route helpers for the auth guard. No runtime deps (safe under
 * `node --test`), so the redirect-builder logic is unit-testable in isolation.
 *
 * The auth-guard trap this fixes: the middleware used to set `next` to the bare
 * `pathname`, DROPPING the query string. That meant an unauthenticated user
 * returning from the Instagram OAuth callback to
 * `/studio/settings?instagram=connected` got bounced to
 * `/auth?next=/studio/settings` and lost the `?instagram=…` signal entirely.
 * We now preserve the full path + query in `next`.
 */

/**
 * The `next` param value to stash before bouncing to `/auth`: the full
 * destination path INCLUDING its query string. `search` should be the raw
 * search string (with leading `?`, or empty) as exposed by `URL.search` /
 * `NextURL.search`.
 */
export function nextParamFor(pathname: string, search = ""): string {
  return `${pathname}${search}`;
}

/**
 * Build the sign-in redirect path (`/auth?next=<encoded path+query>`) for a
 * given destination. `URLSearchParams` handles the encoding, so the value
 * round-trips: `new URLSearchParams(result.split("?")[1]).get("next")` yields
 * back the original `pathname + search`.
 */
export function buildAuthRedirectPath(pathname: string, search = ""): string {
  const params = new URLSearchParams();
  params.set("next", nextParamFor(pathname, search));
  return `/auth?${params.toString()}`;
}
