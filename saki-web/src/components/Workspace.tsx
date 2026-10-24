import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { FileUp } from 'lucide-react';
import { ChatPanel } from '@/components/ChatPanel';
import { EditorPanel } from '@/components/EditorPanel';
import { SessionSidebar } from '@/components/SessionSidebar';
import { SettingsDialog } from '@/components/SettingsDialog';
import { TopBar } from '@/components/TopBar';
import { importCodeFile } from '@/hooks/useCodeImport';
import { useStompSession } from '@/hooks/useStompSession';
import { useAudioStore } from '@/store/audioStore';
import { useAuthStore } from '@/store/authStore';
import { useWorkspaceStore } from '@/store/workspaceStore';

export type MobileView = 'editor' | 'chat';

const EDITOR_KEY = 'saki-editor-open';

function readEditorOpen(): boolean {
  try {
    return localStorage.getItem(EDITOR_KEY) !== '0';
  } catch {
    return true;
  }
}

export function Workspace() {
  const token = useAuthStore((s) => s.token);
  const activeSessionId = useWorkspaceStore((s) => s.activeSessionId);
  const connection = useStompSession(token, activeSessionId);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileView, setMobileView] = useState<MobileView>('chat');
  const [editorOpen, setEditorOpen] = useState(readEditorOpen);
  const [dragging, setDragging] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const dragDepth = useRef(0);

  useEffect(() => {
    void useWorkspaceStore.getState().loadSessions();
    const flush = () => void useWorkspaceStore.getState().flushEditorSave();
    window.addEventListener('beforeunload', flush);
    return () => {
      window.removeEventListener('beforeunload', flush);
      useAudioStore.getState().stop();
      useWorkspaceStore.getState().reset();
    };
  }, []);

  const toggleEditor = () => {
    setEditorOpen((open) => {
      try {
        localStorage.setItem(EDITOR_KEY, open ? '0' : '1');
      } catch {
        // Not persisted.
      }
      return !open;
    });
  };

  const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer.types).includes('Files');

  return (
    <div
      className="relative flex h-full flex-col"
      onDragEnter={(e) => {
        if (!hasFiles(e)) return;
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!hasFiles(e)) return;
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDragging(false);
      }}
      onDragOver={(e) => hasFiles(e) && e.preventDefault()}
      onDrop={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) {
          void importCodeFile(file).then((ok) => {
            if (ok) {
              setEditorOpen(true);
              setMobileView('editor');
            }
          });
        }
      }}
    >
      <TopBar
        connection={connection}
        onToggleSidebar={() => setSidebarOpen((open) => !open)}
        mobileView={mobileView}
        onMobileViewChange={setMobileView}
        editorOpen={editorOpen}
        onToggleEditor={toggleEditor}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <div className="relative flex min-h-0 flex-1">
        <SessionSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex min-w-0 flex-1 bg-ink-900">
          <section
            className={`${mobileView === 'chat' ? 'flex' : 'hidden'} min-w-0 flex-1 flex-col lg:flex`}
            aria-label="Conversation with Saki"
          >
            <ChatPanel onShowEditor={() => {
              setEditorOpen(true);
              setMobileView('editor');
            }} />
          </section>
          <section
            className={`${mobileView === 'editor' ? 'flex' : 'hidden'} ${
              editorOpen ? 'lg:flex' : 'lg:hidden'
            } w-full min-w-0 flex-col border-ink-700 lg:w-[44%] lg:shrink-0 lg:border-l xl:w-[46%]`}
            aria-label="Code editor"
          >
            <EditorPanel />
          </section>
        </main>
      </div>

      <SettingsDialog open={settingsOpen} onClose={closeSettings} />

      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-ink-950/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-saki-500 bg-ink-850 px-10 py-8 text-center">
            <FileUp className="h-8 w-8 text-saki-400" />
            <p className="text-base font-semibold">Drop a code file to open it</p>
            <p className="text-sm text-ink-400">Saki will read it when you ask your next question.</p>
          </div>
        </div>
      )}
    </div>
  );
}
