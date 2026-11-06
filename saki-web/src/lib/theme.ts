import { flushSync } from 'react-dom';
import { create } from 'zustand';

export type Theme = 'dark' | 'light';
/** What the user chose: a fixed theme, or follow the device's light / dark setting. */
export type ThemePreference = Theme | 'system';

/**
 * Chat color themes; each one is a set of CSS variables in index.css. `swatch` repeats the
 * dark-mode gradient and `surface` the dark background, only for the previews in Settings.
 */
export const PALETTES = [
  {
    id: 'classic',
    name: 'Saki',
    description: 'Green, cyan and blue from Saki’s logo',
    swatch: ['#34e27a', '#13c8f5', '#2f6bff', '#6a4cff'],
    accent: '#22c8f5',
    surface: '#080c1d',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Navy, sky blue and violet',
    swatch: ['#38c8f0', '#3b82f6', '#6366f1', '#a855f7'],
    accent: '#38bdf8',
    surface: '#0a0d1c',
  },
  {
    id: 'forest',
    name: 'Forest',
    description: 'Deep green, emerald and sky',
    swatch: ['#a3e635', '#34d399', '#14b8a6', '#0ea5e9'],
    accent: '#34d399',
    surface: '#08120e',
  },
  {
    id: 'sunset',
    name: 'Sunset',
    description: 'Warm orange and rose',
    swatch: ['#fbbf24', '#f97316', '#f43f5e', '#d946ef'],
    accent: '#fb923c',
    surface: '#150c09',
  },
  {
    id: 'lavender',
    name: 'Lavender',
    description: 'Soft violet and pink',
    swatch: ['#818cf8', '#a78bfa', '#e879f9', '#f472b6'],
    accent: '#a78bfa',
    surface: '#0f0b19',
  },
] as const;

export type Palette = (typeof PALETTES)[number]['id'];

const THEME_KEY = 'saki-theme';
const PALETTE_KEY = 'saki-palette';

const darkQuery = () => window.matchMedia?.('(prefers-color-scheme: dark)');

/** The device's own light / dark setting (dark when unknown). */
function systemTheme(): Theme {
  const query = darkQuery();
  return !query || query.matches ? 'dark' : 'light';
}

/** The theme index.html already applied before React loaded (avoids a flash). */
function initialTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

function initialPreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  } catch {
    return 'system';
  }
}

function initialPalette(): Palette {
  const applied = document.documentElement.dataset.palette;
  return PALETTES.some((p) => p.id === applied) ? (applied as Palette) : 'classic';
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not persisted (private mode); the choice still applies for this tab.
  }
}

/** Keeps the browser UI color (mobile address bar) in step with the page background. */
function syncThemeColor() {
  const color = getComputedStyle(document.documentElement).getPropertyValue('--ink-900').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
}

/** Where a theme switch was clicked; the new theme spreads out from here. */
export interface RevealOrigin {
  x: number;
  y: number;
}

/** The center of a clicked element, as the starting point of the theme reveal. */
export function centerOf(element: Element): RevealOrigin {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * Runs a theme change as a circular reveal from `origin` (View Transitions API); browsers
 * without it, or with reduced motion on, switch instantly.
 */
function withReveal(change: () => void, origin?: RevealOrigin) {
  if (!document.startViewTransition || reducedMotion()) {
    change();
    return;
  }
  const x = origin?.x ?? window.innerWidth / 2;
  const y = origin?.y ?? window.innerHeight / 2;
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  const transition = document.startViewTransition(change);
  transition.ready
    .then(() =>
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 650, easing: 'cubic-bezier(0.45, 0, 0.2, 1)', pseudoElement: '::view-transition-new(root)' },
      ),
    )
    .catch(() => undefined);
}

interface ThemeState {
  /** The theme on screen. */
  theme: Theme;
  /** The user's choice; 'system' follows the device. */
  preference: ThemePreference;
  palette: Palette;
  /** Switches to the other theme (and stops following the device). */
  toggle: (origin?: RevealOrigin) => void;
  setPreference: (preference: ThemePreference, origin?: RevealOrigin) => void;
  setPalette: (palette: Palette) => void;
}

export const useThemeStore = create<ThemeState>()((set, get) => {
  /** Puts `theme` on screen (with the circular reveal when it changes). */
  const showTheme = (theme: Theme, origin?: RevealOrigin) => {
    if (theme === get().theme) return;
    withReveal(() => {
      document.documentElement.dataset.theme = theme;
      syncThemeColor();
      // Render the new theme (icons, editor) before the browser captures the "after" view.
      flushSync(() => set({ theme }));
    }, origin);
  };

  // Follow the device when it switches between light and dark (e.g. at sunset).
  darkQuery()?.addEventListener('change', () => {
    if (get().preference === 'system') showTheme(systemTheme());
  });

  return {
    theme: initialTheme(),
    preference: initialPreference(),
    palette: initialPalette(),
    toggle: (origin) => get().setPreference(get().theme === 'dark' ? 'light' : 'dark', origin),
    setPreference: (preference, origin) => {
      save(THEME_KEY, preference);
      set({ preference });
      showTheme(preference === 'system' ? systemTheme() : preference, origin);
    },
    setPalette: (palette) => {
      if (palette === 'classic') delete document.documentElement.dataset.palette;
      else document.documentElement.dataset.palette = palette;
      save(PALETTE_KEY, palette);
      syncThemeColor();
      set({ palette });
    },
  };
});
