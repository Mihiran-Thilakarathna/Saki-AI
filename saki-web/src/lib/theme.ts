import { create } from 'zustand';

export type Theme = 'dark' | 'light';

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

/** The theme index.html already applied before React loaded (avoids a flash). */
function initialTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
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

interface ThemeState {
  theme: Theme;
  palette: Palette;
  toggle: () => void;
  setTheme: (theme: Theme) => void;
  setPalette: (palette: Palette) => void;
}

export const useThemeStore = create<ThemeState>()((set, get) => ({
  theme: initialTheme(),
  palette: initialPalette(),
  toggle: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
  setTheme: (theme) => {
    document.documentElement.dataset.theme = theme;
    save(THEME_KEY, theme);
    syncThemeColor();
    set({ theme });
  },
  setPalette: (palette) => {
    if (palette === 'classic') delete document.documentElement.dataset.palette;
    else document.documentElement.dataset.palette = palette;
    save(PALETTE_KEY, palette);
    syncThemeColor();
    set({ palette });
  },
}));
