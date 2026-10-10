import { fetchDisplayCalendarCached } from './displayCalendarCache';

let installed = false;

/** Wrap `window.fetch` so display-calendar requests use IndexedDB stale-while-revalidate. */
export function installDisplayCalendarFetch(): () => void {
  if (typeof window === 'undefined' || installed) {
    return () => {};
  }

  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) =>
    fetchDisplayCalendarCached(input, init, nativeFetch);

  installed = true;
  return () => {
    window.fetch = nativeFetch;
    installed = false;
  };
}
