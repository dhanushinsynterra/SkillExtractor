import { useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';

/**
 * Tiny hash router. Navigations run inside a same-document view transition
 * when the browser supports it, with a direction hint for the CSS.
 */
type Listener = () => void;
const listeners = new Set<Listener>();

const read = () => location.hash.replace(/^#/, '') || '/';
let current = read();

function emit() {
  for (const l of listeners) l();
}

function commit(to: string, direction: 'forward' | 'back') {
  const apply = () => {
    current = to;
    flushSync(emit);
    window.scrollTo({ top: 0 });
  };
  const focusHeading = () => document.querySelector<HTMLElement>('[data-route-focus]')?.focus({ preventScroll: true });

  if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    apply();
    focusHeading();
    return;
  }
  document.documentElement.dataset.navDirection = direction;
  const t = document.startViewTransition(apply);
  t.finished.finally(() => {
    delete document.documentElement.dataset.navDirection;
    focusHeading();
  });
}

export function navigate(to: string, direction: 'forward' | 'back' = 'forward') {
  if (to === current) return;
  history.pushState(null, '', `#${to}`);
  commit(to, direction);
}

window.addEventListener('popstate', () => commit(read(), 'back'));

function subscribe(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useRoute() {
  return useSyncExternalStore(subscribe, () => current);
}

/** Matches "/report/:id" style patterns. Returns params or null. */
export function match(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/');
  const s = path.split('/');
  if (p.length !== s.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(s[i]);
    else if (p[i] !== s[i]) return null;
  }
  return params;
}
