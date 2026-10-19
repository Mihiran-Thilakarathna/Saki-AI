import { useEffect, useRef, useState } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { Check, CheckCheck, Copy, Download, FileCode2, FileUp, Loader2 } from 'lucide-react';
import { importCodeFile } from '@/hooks/useCodeImport';
import { IMPORT_ACCEPT } from '@/lib/fileImport';
import { EDITOR_LANGUAGES } from '@/lib/languages';
import { SAKI_DARK_THEME, SAKI_LIGHT_THEME } from '@/lib/monacoSetup';
import { useThemeStore } from '@/lib/theme';
import { toast } from '@/store/toastStore';
import { useWorkspaceStore } from '@/store/workspaceStore';

type MonacoEditor = Parameters<OnMount>[0];

export function EditorPanel() {
  const code = useWorkspaceStore((s) => s.editorCode);
  const language = useWorkspaceStore((s) => s.editorLanguage);
  const fileName = useWorkspaceStore((s) => s.fileName);
  const dirty = useWorkspaceStore((s) => s.editorDirty);
  const injectionCount = useWorkspaceStore((s) => s.injectionCount);
  const sessionLoading = useWorkspaceStore((s) => s.sessionLoading);
  const activeSessionId = useWorkspaceStore((s) => s.activeSessionId);
  const setEditorCode = useWorkspaceStore((s) => s.setEditorCode);
  const setEditorLanguage = useWorkspaceStore((s) => s.setEditorLanguage);
  const setFileName = useWorkspaceStore((s) => s.setFileName);

  const theme = useThemeStore((s) => s.theme);
  const editorRef = useRef<MonacoEditor | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const [flashKey, setFlashKey] = useState(0);

  // When Saki injects code: reveal the top of the file and flash the frame.
  useEffect(() => {
    if (injectionCount === 0) return;
    setFlashKey(injectionCount);
    editorRef.current?.setScrollTop(0);
    editorRef.current?.setPosition({ lineNumber: 1, column: 1 });
  }, [injectionCount]);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Clipboard access was blocked by the browser.');
    }
  };

  const onDownload = () => {
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName.trim() || 'saki-snippet.txt';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-ink-700 bg-ink-850 px-3">
        <FileCode2 className="h-4 w-4 shrink-0 text-saki-400" />
        <input
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
          className="min-w-0 flex-1 rounded bg-transparent px-1 py-0.5 font-mono text-sm text-ink-100 outline-none hover:bg-ink-800 focus:bg-ink-800"
          aria-label="File name"
          spellCheck={false}
        />
        <span
          className="flex shrink-0 items-center text-ink-400"
          aria-live="polite"
          title={dirty ? 'Saving…' : 'Saved'}
          aria-label={dirty ? 'Saving' : 'Saved'}
        >
          {dirty ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
        </span>

        <div className="ml-auto flex items-center gap-1">
          <input
            ref={fileInputRef}
            type="file"
            accept={IMPORT_ACCEPT}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importCodeFile(file);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            className="btn-secondary mr-1 px-2 py-1 text-xs"
            onClick={() => fileInputRef.current?.click()}
            disabled={!activeSessionId}
            title="Open a code file from your computer"
            aria-label="Import a code file"
          >
            <FileUp className="h-3.5 w-3.5" />
            <span className="hidden 2xl:inline">Import</span>
          </button>
          <select
            value={language}
            onChange={(e) => setEditorLanguage(e.target.value)}
            className="rounded-lg border border-ink-700 bg-ink-850 px-2 py-1 text-xs text-ink-200 outline-none focus:border-saki-500"
            aria-label="Editor language"
          >
            {EDITOR_LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
          <button type="button" className="icon-btn" onClick={onCopy} title="Copy code" aria-label="Copy code" disabled={!code}>
            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={onDownload}
            title="Download file"
            aria-label="Download file"
            disabled={!code}
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        {flashKey > 0 && <div key={flashKey} className="pointer-events-none absolute inset-0 z-20 animate-flash" />}
        {sessionLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-ink-900/70">
            <Loader2 className="h-6 w-6 animate-spin text-saki-400" />
          </div>
        )}
        {!code && !sessionLoading && activeSessionId && (
          <div className="pointer-events-none absolute inset-x-0 top-1/3 z-10 mx-auto max-w-sm px-6 text-center">
            <FileCode2 className="mx-auto h-8 w-8 text-ink-600" />
            <p className="mt-3 text-sm font-medium text-ink-200">Your editor is empty</p>
            <p className="mt-1 text-sm text-ink-400">
              Code from Saki’s answers appears here. You can also type, paste, import or drag in your own file.
            </p>
          </div>
        )}
        <Editor
          theme={theme === 'light' ? SAKI_LIGHT_THEME : SAKI_DARK_THEME}
          language={language}
          value={code}
          onChange={(value) => setEditorCode(value ?? '')}
          onMount={(editor) => {
            editorRef.current = editor;
          }}
          loading={<Loader2 className="h-6 w-6 animate-spin text-saki-400" />}
          options={{
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: 14,
            fontLigatures: true,
            minimap: { enabled: true, scale: 1, renderCharacters: false },
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 4,
            wordWrap: 'off',
            renderLineHighlight: 'all',
            padding: { top: 12, bottom: 12 },
            bracketPairColorization: { enabled: true },
            stickyScroll: { enabled: true },
          }}
        />
      </div>
    </div>
  );
}
