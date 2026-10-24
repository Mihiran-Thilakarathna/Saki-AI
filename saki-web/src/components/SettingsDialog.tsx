import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Check,
  Download,
  FileJson,
  FileText,
  History,
  Loader2,
  LogOut,
  MessagesSquare,
  Moon,
  Palette as PaletteIcon,
  Search,
  Sun,
  Trash2,
  User,
  Volume2,
  X,
} from 'lucide-react';
import { exportChats, type ExportFormat } from '@/lib/chatExport';
import { errorMessage } from '@/lib/apiClient';
import { PALETTES, useThemeStore } from '@/lib/theme';
import { PLAYBACK_RATES, useAudioStore } from '@/store/audioStore';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/toastStore';
import { useWorkspaceStore } from '@/store/workspaceStore';

export type SettingsTab = 'profile' | 'appearance' | 'voice' | 'history';

const TABS: { id: SettingsTab; label: string; icon: typeof User }[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'appearance', label: 'Appearance', icon: PaletteIcon },
  { id: 'voice', label: 'Voice', icon: Volume2 },
  { id: 'history', label: 'Chat history', icon: History },
];

interface Props {
  open: boolean;
  initialTab?: SettingsTab;
  onClose: () => void;
}

/** Settings: profile, light/dark mode and chat theme, voice options, and chat history tools. */
export function SettingsDialog({ open, initialTab = 'profile', onClose }: Props) {
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, initialTab, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="card relative flex h-[88vh] w-full max-w-3xl animate-fade-in flex-col overflow-hidden rounded-b-none shadow-2xl outline-none sm:h-[min(620px,90vh)] sm:rounded-2xl"
      >
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-ink-700 px-4 sm:px-5">
          <h2 id="settings-title" className="text-base font-semibold">
            Settings
          </h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close settings">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          <nav
            className="flex shrink-0 gap-1 overflow-x-auto border-b border-ink-700 p-2 sm:w-52 sm:flex-col sm:overflow-visible sm:border-r sm:border-b-0 sm:p-3"
            aria-label="Settings sections"
          >
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                aria-current={tab === id ? 'page' : undefined}
                className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  tab === id ? 'bg-saki-500/12 text-ink-100' : 'text-ink-300 hover:bg-ink-800 hover:text-ink-100'
                }`}
              >
                <Icon className={`h-4 w-4 ${tab === id ? 'text-saki-400' : ''}`} />
                {label}
              </button>
            ))}
          </nav>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            {tab === 'profile' && <ProfileSection onClose={onClose} />}
            {tab === 'appearance' && <AppearanceSection />}
            {tab === 'voice' && <VoiceSection />}
            {tab === 'history' && <HistorySection onClose={onClose} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-[15px] font-semibold text-ink-100">{title}</h3>
      {description && <p className="mt-0.5 text-sm text-ink-400">{description}</p>}
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-700 py-3.5 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink-100">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-ink-400">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ Profile */

const dateFormat = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

function ProfileSection({ onClose }: { onClose: () => void }) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const chatCount = useWorkspaceStore((s) => s.sessions.length);
  const initial = user?.fullName?.trim().charAt(0).toUpperCase() ?? '?';

  const onLogout = async () => {
    onClose();
    await useWorkspaceStore.getState().flushEditorSave();
    logout();
  };

  return (
    <>
      <SectionTitle title="Your profile" description="The account you use to sign in to Saki." />
      <div className="flex items-center gap-4 rounded-2xl border border-ink-700 bg-ink-800/50 p-4">
        <span className="bg-brand flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-xl font-semibold text-white">
          {initial}
        </span>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-ink-100">{user?.fullName}</p>
          <p className="truncate text-sm text-ink-400">{user?.email}</p>
        </div>
      </div>
      <div className="mt-4">
        <Row label="Speaks with you in">
          <span className="text-sm text-ink-300">
            {user?.preferredLanguage === 'en-US' ? 'English' : 'Sinhala and English'}
          </span>
        </Row>
        <Row label="Member since">
          <span className="text-sm text-ink-300">{user?.createdAt ? dateFormat.format(new Date(user.createdAt)) : '—'}</span>
        </Row>
        <Row label="Chats">
          <span className="text-sm text-ink-300 tabular-nums">{chatCount}</span>
        </Row>
        <Row label="Legal">
          <span className="flex gap-3 text-sm">
            <a href="/privacy" className="text-saki-400 hover:underline">Privacy Policy</a>
            <a href="/terms" className="text-saki-400 hover:underline">Terms</a>
          </span>
        </Row>
      </div>
      <button type="button" className="btn-secondary mt-5" onClick={() => void onLogout()}>
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </>
  );
}

/* --------------------------------------------------------------- Appearance */

function AppearanceSection() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const palette = useThemeStore((s) => s.palette);
  const setPalette = useThemeStore((s) => s.setPalette);

  return (
    <>
      <SectionTitle title="Mode" description="Light or dark background." />
      <div className="grid grid-cols-2 gap-3">
        {(
          [
            ['dark', 'Dark', Moon],
            ['light', 'Light', Sun],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTheme(id)}
            aria-pressed={theme === id}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${
              theme === id
                ? 'border-saki-500 bg-saki-500/10 text-ink-100 ring-2 ring-saki-500/25'
                : 'border-ink-700 text-ink-300 hover:border-ink-600 hover:text-ink-100'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
            {theme === id && <Check className="ml-auto h-4 w-4 text-saki-400" />}
          </button>
        ))}
      </div>

      <div className="mt-8">
        <SectionTitle
          title="Chat theme"
          description="Colors for the whole app: buttons, highlights, the editor and Saki's animations."
        />
        <div className="grid gap-3 sm:grid-cols-2">
          {PALETTES.map((p) => {
            const selected = palette === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPalette(p.id)}
                aria-pressed={selected}
                className={`group overflow-hidden rounded-xl border text-left transition ${
                  selected
                    ? 'border-saki-500 ring-2 ring-saki-500/25'
                    : 'border-ink-700 hover:border-ink-600'
                }`}
              >
                {/* Mini preview: dark surface, a gradient button and an accent line. */}
                <span className="relative block h-20 px-3 pt-3" style={{ background: p.surface }}>
                  <span
                    className="block h-6 w-24 rounded-md"
                    style={{ backgroundImage: `linear-gradient(110deg, ${p.swatch.join(', ')})` }}
                  />
                  <span className="mt-2 block h-1.5 w-32 rounded-full opacity-90" style={{ background: p.accent }} />
                  <span className="mt-1.5 block h-1.5 w-20 rounded-full bg-white/15" />
                  <span className="absolute right-3 bottom-3 flex gap-1">
                    {p.swatch.map((color) => (
                      <span key={color} className="h-3 w-3 rounded-full" style={{ background: color }} />
                    ))}
                  </span>
                </span>
                <span className="flex items-center gap-2 px-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink-100">{p.name}</span>
                    <span className="block truncate text-xs text-ink-400">{p.description}</span>
                  </span>
                  {selected && <Check className="ml-auto h-4 w-4 shrink-0 text-saki-400" />}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------- Voice */

function VoiceSection() {
  const muted = useAudioStore((s) => s.muted);
  const toggleMute = useAudioStore((s) => s.toggleMute);
  const rate = useAudioStore((s) => s.playbackRate);
  const setRate = useAudioStore((s) => s.setPlaybackRate);

  return (
    <>
      <SectionTitle title="Saki's voice" description="How Saki reads its answers aloud." />
      <Row label="Speak answers aloud" hint="When off, answers stay silent until you press play.">
        <Toggle checked={!muted} onChange={toggleMute} label="Speak answers aloud" />
      </Row>
      <div className="border-b border-ink-700 py-3.5">
        <p className="text-sm font-medium text-ink-100">Playback speed</p>
        <p className="mt-0.5 text-xs text-ink-400">Applies to every answer, including the one playing now.</p>
        <div className="mt-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Playback speed">
          {PLAYBACK_RATES.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={rate === value}
              onClick={() => setRate(value)}
              className={`min-w-14 rounded-lg border px-3 py-1.5 text-sm font-medium tabular-nums transition ${
                rate === value
                  ? 'bg-brand border-transparent text-white'
                  : 'border-ink-700 text-ink-300 hover:border-ink-600 hover:text-ink-100'
              }`}
            >
              {value === 1 ? 'Normal' : `${value}×`}
            </button>
          ))}
        </div>
      </div>
      <div className="py-3.5">
        <p className="flex items-center gap-2 text-sm font-medium text-ink-100">
          <Download className="h-4 w-4 text-saki-400" /> Download a voice answer
        </p>
        <p className="mt-1 text-xs leading-relaxed text-ink-400">
          Press the download button on an answer’s voice player to save it as an MP3. Voices are saved with your
          chats, so earlier answers can be played again after a reload or on another device.
        </p>
      </div>
    </>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-brand' : 'bg-ink-600'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : ''
        }`}
      />
    </button>
  );
}

/* ------------------------------------------------------------------ History */

const relativeTime = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

function formatUpdated(iso: string): string {
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (Math.abs(minutes) < 60) return relativeTime.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relativeTime.format(hours, 'hour');
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return relativeTime.format(days, 'day');
  return dateFormat.format(new Date(iso));
}

function HistorySection({ onClose }: { onClose: () => void }) {
  const sessions = useWorkspaceStore((s) => s.sessions);
  const activeSessionId = useWorkspaceStore((s) => s.activeSessionId);
  const selectSession = useWorkspaceStore((s) => s.selectSession);
  const clearHistory = useWorkspaceStore((s) => s.clearHistory);
  const [query, setQuery] = useState('');
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? sessions.filter((s) => s.title.toLowerCase().includes(q)) : sessions;
  }, [sessions, query]);

  const onExport = async (format: ExportFormat) => {
    setExporting(format);
    try {
      await useWorkspaceStore.getState().flushEditorSave();
      const count = await exportChats(sessions, format);
      toast.success(`Exported ${count} ${count === 1 ? 'chat' : 'chats'}.`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setExporting(null);
    }
  };

  const onClear = async () => {
    setClearing(true);
    const ok = await clearHistory();
    setClearing(false);
    setConfirmClear(false);
    if (ok) toast.success('Your chat history was cleared.');
  };

  return (
    <>
      <SectionTitle title="Your chats" description="Open any earlier chat, export them or clear your history." />

      <label className="relative block">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <input
          className="field pl-9"
          placeholder="Search chats"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search chats"
        />
      </label>

      <ul className="mt-3 max-h-64 space-y-0.5 overflow-y-auto rounded-xl border border-ink-700 p-1">
        {filtered.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-ink-400">{query ? 'No chats match.' : 'No chats yet.'}</li>
        )}
        {filtered.map((session) => (
          <li key={session.id}>
            <button
              type="button"
              onClick={() => {
                void selectSession(session.id);
                onClose();
              }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition ${
                session.id === activeSessionId ? 'bg-saki-500/10' : 'hover:bg-ink-800'
              }`}
            >
              <MessagesSquare
                className={`h-4 w-4 shrink-0 ${session.id === activeSessionId ? 'text-saki-400' : 'text-ink-400'}`}
              />
              <span className="sinhala min-w-0 flex-1 truncate text-sm text-ink-100">{session.title}</span>
              <span className="shrink-0 text-[11px] text-ink-400">{formatUpdated(session.updatedAt)}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-6">
        <p className="text-sm font-medium text-ink-100">Export</p>
        <p className="mt-0.5 text-xs text-ink-400">Download every chat with its questions, answers and code.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(
            [
              ['markdown', 'Markdown (.md)', FileText],
              ['json', 'JSON (.json)', FileJson],
            ] as const
          ).map(([format, label, Icon]) => (
            <button
              key={format}
              type="button"
              className="btn-secondary"
              disabled={exporting !== null || sessions.length === 0}
              onClick={() => void onExport(format)}
            >
              {exporting === format ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-rose-500/30 bg-rose-500/5 p-4">
        <p className="text-sm font-medium text-ink-100">Clear chat history</p>
        <p className="mt-0.5 text-xs text-ink-400">
          Permanently deletes all {sessions.length} {sessions.length === 1 ? 'chat' : 'chats'} with their messages and
          code. This cannot be undone.
        </p>
        {confirmClear ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={clearing}
              onClick={() => void onClear()}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:opacity-50"
            >
              {clearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Yes, delete everything
            </button>
            <button type="button" className="btn-secondary" disabled={clearing} onClick={() => setConfirmClear(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={sessions.length === 0}
            onClick={() => setConfirmClear(true)}
            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-rose-500/40 px-3.5 py-2 text-sm font-semibold text-rose-500 transition hover:bg-rose-500/10 disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" /> Clear history
          </button>
        )}
      </div>
    </>
  );
}
