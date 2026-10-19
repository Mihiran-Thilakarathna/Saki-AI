import { useEffect, useRef, useState } from 'react';
import { Code2, LogOut, Menu, MessageSquare, Moon, PanelRightClose, PanelRightOpen, Sun, Volume2, VolumeX } from 'lucide-react';
import { SakiLogo } from '@/components/SakiLogo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useThemeStore } from '@/lib/theme';
import type { MobileView } from '@/components/Workspace';
import type { ConnectionStatus } from '@/hooks/useStompSession';
import { useAudioStore } from '@/store/audioStore';
import { useAuthStore } from '@/store/authStore';
import { useWorkspaceStore } from '@/store/workspaceStore';

interface Props {
  connection: ConnectionStatus;
  onToggleSidebar: () => void;
  mobileView: MobileView;
  onMobileViewChange: (view: MobileView) => void;
  editorOpen: boolean;
  onToggleEditor: () => void;
}

const CONNECTION: Record<ConnectionStatus, { text: string; dot: string }> = {
  connected: { text: 'Connected · phone sync is live', dot: 'bg-emerald-500' },
  connecting: { text: 'Reconnecting…', dot: 'bg-amber-500 animate-pulse' },
  disconnected: { text: 'Offline', dot: 'bg-ink-400' },
};

export function TopBar({ connection, onToggleSidebar, mobileView, onMobileViewChange, editorOpen, onToggleEditor }: Props) {
  const muted = useAudioStore((s) => s.muted);
  const toggleMute = useAudioStore((s) => s.toggleMute);
  const status = CONNECTION[connection];

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-ink-700 bg-ink-850 px-2 sm:px-4">
      <button type="button" className="icon-btn lg:hidden" onClick={onToggleSidebar} aria-label="Show chats">
        <Menu className="h-5 w-5" />
      </button>
      <div className="flex shrink-0 items-center gap-2.5">
        <SakiLogo size={30} />
        <span className="hidden text-[15px] font-semibold tracking-tight sm:inline">Saki AI</span>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <div className="mr-1 flex rounded-lg bg-ink-800 p-0.5 lg:hidden" role="tablist" aria-label="View">
          {(
            [
              ['chat', MessageSquare, 'Chat'],
              ['editor', Code2, 'Code'],
            ] as const
          ).map(([view, Icon, label]) => (
            <button
              key={view}
              type="button"
              role="tab"
              aria-selected={mobileView === view}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                mobileView === view ? 'bg-ink-850 text-ink-100 shadow-sm' : 'text-ink-400'
              }`}
              onClick={() => onMobileViewChange(view)}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        <span className="mr-1 hidden h-9 items-center px-2 md:flex" title={status.text} aria-label={status.text}>
          <span className={`h-2 w-2 rounded-full ${status.dot}`} />
        </span>
        <button
          type="button"
          className="icon-btn hidden lg:inline-flex"
          onClick={onToggleEditor}
          aria-label={editorOpen ? 'Hide code editor' : 'Show code editor'}
          title={editorOpen ? 'Hide code editor' : 'Show code editor'}
        >
          {editorOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={toggleMute}
          aria-label={muted ? 'Turn Saki’s voice on' : 'Mute Saki’s voice'}
          title={muted ? 'Turn Saki’s voice on' : 'Mute Saki’s voice'}
        >
          {muted ? <VolumeX className="h-4 w-4 text-rose-500" /> : <Volume2 className="h-4 w-4" />}
        </button>
        <ThemeToggle className="icon-btn hidden sm:inline-flex" />
        <UserMenu />
      </div>
    </header>
  );
}

function UserMenu() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggle);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const onLogout = async () => {
    await useWorkspaceStore.getState().flushEditorSave();
    logout();
  };

  const initial = user?.fullName?.trim().charAt(0).toUpperCase() ?? '?';

  return (
    <div className="relative ml-1 shrink-0" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-700 text-sm font-semibold text-ink-100 ring-offset-2 ring-offset-ink-850 transition hover:ring-2 hover:ring-saki-500"
        aria-label="Account menu"
        aria-expanded={open}
      >
        {initial}
      </button>
      {open && (
        <div className="card absolute top-11 right-0 z-50 w-64 animate-fade-in p-1.5 shadow-xl" role="menu">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-semibold text-ink-100">{user?.fullName}</p>
            <p className="truncate text-xs text-ink-400">{user?.email}</p>
          </div>
          <div className="my-1 h-px bg-ink-700" />
          <button
            type="button"
            role="menuitem"
            onClick={toggleTheme}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-200 hover:bg-ink-800 hover:text-ink-100"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={onLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-200 hover:bg-ink-800 hover:text-ink-100"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
