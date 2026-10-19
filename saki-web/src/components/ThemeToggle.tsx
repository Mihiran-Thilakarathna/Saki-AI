import { Moon, Sun } from 'lucide-react';
import { useThemeStore } from '@/lib/theme';

export function ThemeToggle({ className = 'icon-btn' }: { className?: string }) {
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  return (
    <button type="button" className={className} onClick={toggle} aria-label={label} title={label}>
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
