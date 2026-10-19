import { useState, type FormEvent } from 'react';
import { Check, Loader2, MessagesSquare, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import type { SessionSummary } from '@/types/api';

interface Props {
  open: boolean;
  onClose: () => void;
}

const relativeTime = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

function formatUpdated(iso: string): string {
  const diffMinutes = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (Math.abs(diffMinutes) < 60) return relativeTime.format(diffMinutes, 'minute');
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return relativeTime.format(diffHours, 'hour');
  return relativeTime.format(Math.round(diffHours / 24), 'day');
}

export function SessionSidebar({ open, onClose }: Props) {
  const sessions = useWorkspaceStore((s) => s.sessions);
  const loading = useWorkspaceStore((s) => s.sessionsLoading);
  const activeSessionId = useWorkspaceStore((s) => s.activeSessionId);
  const selectSession = useWorkspaceStore((s) => s.selectSession);
  const createSession = useWorkspaceStore((s) => s.createSession);
  const [creating, setCreating] = useState(false);

  const onCreate = async () => {
    setCreating(true);
    await createSession();
    setCreating(false);
    onClose();
  };

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/50 backdrop-blur-[1px] lg:hidden" onClick={onClose} aria-hidden="true" />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-ink-700 bg-ink-850 transition-transform lg:static lg:z-auto lg:w-64 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Your chats"
      >
        <div className="flex items-center justify-between px-3 pt-3 pb-2 lg:hidden">
          <span className="px-1 text-sm font-semibold">Chats</span>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close chats">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-3 pt-0 pb-3 lg:pt-3">
          <button type="button" onClick={onCreate} disabled={creating} className="btn-primary w-full">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            New chat
          </button>
        </div>
        <h2 className="px-5 pt-1 pb-2 text-[11px] font-semibold tracking-wider text-ink-400 uppercase">Recent</h2>
        <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
          {loading && sessions.length === 0 && (
            <div className="flex justify-center py-6 text-ink-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
          {sessions.map((session) => (
            <SessionItem
              key={session.id}
              session={session}
              active={session.id === activeSessionId}
              onSelect={() => {
                void selectSession(session.id);
                onClose();
              }}
            />
          ))}
        </nav>
      </aside>
    </>
  );
}

function SessionItem({ session, active, onSelect }: { session: SessionSummary; active: boolean; onSelect: () => void }) {
  const renameSession = useWorkspaceStore((s) => s.renameSession);
  const deleteSession = useWorkspaceStore((s) => s.deleteSession);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(session.title);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const onRename = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (trimmed && trimmed !== session.title) await renameSession(session.id, trimmed);
    setEditing(false);
  };

  if (editing) {
    return (
      <form onSubmit={onRename} className="flex items-center gap-1 rounded-lg bg-ink-750 px-2 py-1.5">
        <input
          autoFocus
          className="sinhala min-w-0 flex-1 bg-transparent text-sm text-ink-100 outline-none"
          value={title}
          maxLength={160}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
          aria-label="Session title"
        />
        <button type="submit" className="icon-btn h-6 w-6" aria-label="Save title">
          <Check className="h-3.5 w-3.5" />
        </button>
      </form>
    );
  }

  return (
    <div
      className={`group relative flex items-center rounded-lg transition ${
        active ? 'bg-saki-500/10 text-ink-100' : 'text-ink-300 hover:bg-ink-800 hover:text-ink-100'
      }`}
    >
      {active && <span className="absolute inset-y-2 left-0 w-1 rounded-full bg-saki-500" />}
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-start gap-2.5 px-3 py-2 text-left">
        <MessagesSquare className={`mt-0.5 h-4 w-4 shrink-0 ${active ? 'text-saki-400' : 'text-ink-400'}`} />
        <span className="min-w-0">
          <span className="sinhala block truncate text-sm">{session.title}</span>
          <span className="block text-[11px] text-ink-400">{formatUpdated(session.updatedAt)}</span>
        </span>
      </button>
      <div className="flex shrink-0 items-center pr-1 opacity-100 lg:opacity-0 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100">
        {confirmDelete ? (
          <>
            <button
              type="button"
              className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-rose-500 hover:bg-rose-500/15"
              onClick={() => void deleteSession(session.id)}
            >
              Delete
            </button>
            <button type="button" className="icon-btn h-6 w-6" onClick={() => setConfirmDelete(false)} aria-label="Cancel delete">
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="icon-btn h-6 w-6"
              onClick={() => {
                setTitle(session.title);
                setEditing(true);
              }}
              aria-label="Rename chat"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button type="button" className="icon-btn h-6 w-6" onClick={() => setConfirmDelete(true)} aria-label="Delete chat">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
