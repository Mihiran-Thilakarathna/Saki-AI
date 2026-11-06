import { Moon, Sun } from 'lucide-react';
import { centerOf, useThemeStore, type Theme } from '@/lib/theme';

const OPTIONS: { theme: Theme; label: string; icon: typeof Sun }[] = [
  { theme: 'light', label: 'Light mode', icon: Sun },
  { theme: 'dark', label: 'Dark mode', icon: Moon },
];

/** Light / dark switch: a small two-option pill with the current mode highlighted. */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const theme = useThemeStore((s) => s.theme);
  const setPreference = useThemeStore((s) => s.setPreference);

  return (
    <div
      role="radiogroup"
      aria-label="Color mode"
      className={`inline-flex items-center gap-0.5 rounded-full border border-ink-700 bg-ink-850/80 p-0.5 shadow-sm backdrop-blur ${className}`}
    >
      {OPTIONS.map(({ theme: option, label, icon: Icon }) => {
        const active = theme === option;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={(e) => !active && setPreference(option, centerOf(e.currentTarget))}
            className={`flex h-7 w-7 items-center justify-center rounded-full transition ${
              active ? 'bg-brand text-white shadow-sm' : 'text-ink-400 hover:bg-ink-750 hover:text-ink-100'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
