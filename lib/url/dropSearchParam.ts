/**
 * Removes one query parameter from the current URL in place. Uses the native History API, which
 * Next (14.1+) keeps in sync with useSearchParams, so - unlike router.replace - it doesn't refetch
 * the page's server data, and every other parameter stays as it was.
 *
 * The state argument must be null: Next's patched replaceState only updates its router when the
 * state isn't already one of its own, and window.history.state always is.
 */
export function dropSearchParam(name: string): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(name)) return;
  url.searchParams.delete(name);
  window.history.replaceState(null, "", url.pathname + url.search + url.hash);
}
