import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'ai-task-hub-theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';
const listeners = new Set<() => void>();

function readTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : 'system';
}

export function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme !== 'system') return theme;
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

function applyTheme() {
  const resolved = resolveTheme(readTheme());
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
}

export function setTheme(theme: Theme) {
  if (theme === 'system') localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, theme);
  applyTheme();
  listeners.forEach((l) => l());
}

window.matchMedia(DARK_QUERY).addEventListener('change', () => {
  applyTheme();
  listeners.forEach((l) => l());
});

window.addEventListener('storage', (e) => {
  if (e.key !== STORAGE_KEY) return;
  applyTheme();
  listeners.forEach((l) => l());
});

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => 'system' as Theme);
  const resolved = useSyncExternalStore(
    subscribe,
    () => resolveTheme(readTheme()),
    () => 'light' as const,
  );
  return { theme, resolvedTheme: resolved, setTheme };
}
