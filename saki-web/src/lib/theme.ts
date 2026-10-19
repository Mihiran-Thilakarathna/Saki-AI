import { create } from 'zustand';

export type Theme = 'dark' | 'light';

const THEME_KEY = 'saki-theme';

/** The theme index.html already applied before React loaded (avoids a flash). */
function initialTheme(): Theme {
  const applied = document.documentElement.dataset.theme;
  return applied === 'light' ? 'light' : 'dark';
}

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Not persisted (private mode); the theme still applies for this tab.
  }
}

interface ThemeState {
  theme: Theme;
  toggle: () => void;
}

export const useThemeStore = create<ThemeState>()((set, get) => ({
  theme: initialTheme(),
  toggle: () => {
    const theme: Theme = get().theme === 'dark' ? 'light' : 'dark';
    apply(theme);
    set({ theme });
  },
}));
