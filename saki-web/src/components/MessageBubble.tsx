import { memo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AlertCircle, Check, Copy, FileCode2, Mic, RotateCcw, Smartphone, X } from 'lucide-react';
import { AudioPlayer } from '@/components/AudioPlayer';
import { SakiLogo } from '@/components/SakiLogo';
import { useTypewriter } from '@/hooks/useTypewriter';
import { defaultFileName, normalizeLanguage } from '@/lib/languages';
import { useAudioStore } from '@/store/audioStore';
import { toast } from '@/store/toastStore';
import { useWorkspaceStore, type ChatMessage } from '@/store/workspaceStore';

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });

function formatDuration(ms: number): string {
  const seconds = Math.max(1, Math.round(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

interface Props {
  message: ChatMessage;
  onOpenCode: () => void;
}

export const MessageBubble = memo(function MessageBubble({ message, onOpenCode }: Props) {
  const time = timeFormat.format(new Date(message.createdAt));
  return message.role === 'USER' ? (
    <UserMessage message={message} time={time} />
  ) : (
    <SakiMessage message={message} time={time} onOpenCode={onOpenCode} />
  );
});

function UserMessage({ message, time }: { message: ChatMessage; time: string }) {
  const retryQuery = useWorkspaceStore((s) => s.retryQuery);
  const dismissFailed = useWorkspaceStore((s) => s.dismissFailed);
  const thinking = useWorkspaceStore((s) => s.thinking);
  const isSinhala = message.language === 'si-LK' || /[඀-෿]/.test(message.text);
  const failed = message.status === 'failed';
  const sending = message.status === 'sending';

  return (
    <div className="flex animate-fade-in justify-end">
      <div className="flex max-w-[85%] flex-col items-end">
        <div
          className={`rounded-2xl rounded-br-md px-4 py-2.5 text-sm ${
            failed
              ? 'border border-rose-500/40 bg-rose-500/10 text-ink-100'
              : 'bg-ink-700 text-ink-100'
          }`}
        >
          {message.voice && (
            <div className={`flex items-center gap-2 ${message.text ? 'mb-1.5' : ''}`}>
              <Mic className="h-3.5 w-3.5 shrink-0 opacity-80" />
              <span className="text-xs font-medium opacity-90">
                Voice message · {formatDuration(message.voice.durationMs)}
              </span>
            </div>
          )}
          {message.voice && (
            // The user's own recording: lets them confirm the mic actually captured their voice.
            <audio src={message.voice.url} controls preload="metadata" className="mb-1 h-8 w-56 max-w-full" />
          )}
          {message.text ? (
            <p className={`whitespace-pre-wrap ${isSinhala ? 'sinhala' : ''}`} lang={isSinhala ? 'si' : 'en'}>
              {message.text}
            </p>
          ) : (
            !message.voice && <span className="italic opacity-70">(no speech detected)</span>
          )}
          {message.voice && sending && !message.text && (
            <p className="text-xs italic opacity-80">Transcribing…</p>
          )}
        </div>

        {failed ? (
          <div className="mt-1.5 flex max-w-full flex-wrap items-center justify-end gap-2 text-xs" role="alert">
            <span className="flex items-center gap-1 text-rose-400">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {message.error ?? 'Saki could not answer.'}
            </span>
            <button
              type="button"
              disabled={thinking}
              onClick={() => void retryQuery(message.id)}
              className="flex items-center gap-1 rounded-md bg-saki-500/15 px-2 py-0.5 font-semibold text-saki-300 hover:bg-saki-500/25 disabled:opacity-40"
            >
              <RotateCcw className="h-3 w-3" /> Retry
            </button>
            <button
              type="button"
              onClick={() => dismissFailed(message.id)}
              className="flex items-center gap-1 text-ink-400 hover:text-ink-100"
              aria-label="Remove this message"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <p className="mt-1 flex items-center gap-1 text-[11px] text-ink-400">
            {message.remote && (
              <>
                <Smartphone className="h-3 w-3" /> From your phone ·
              </>
            )}
            {sending ? 'Sent' : time}
          </p>
        )}
      </div>
    </div>
  );
}

function SakiMessage({ message, time, onOpenCode }: { message: ChatMessage; time: string; onOpenCode: () => void }) {
  const speakingThis = useAudioStore((s) => s.speaking && s.speakingMessageId === message.id);
  const [copied, setCopied] = useState(false);
  const isSinhala = message.language === 'si-LK';
  const code = message.code;
  const hasCode = Boolean(code?.hasCode && code.code);
  const { shown, done } = useTypewriter(message.id, message.text, Boolean(message.fresh));

  const openInEditor = () => {
    if (!code?.code) return;
    const language = normalizeLanguage(code.programmingLanguage);
    // Language/file name first, so the debounced save persists them together with the code.
    useWorkspaceStore.setState({ editorLanguage: language, fileName: code.fileName ?? defaultFileName(language) });
    useWorkspaceStore.getState().setEditorCode(code.code);
    onOpenCode();
  };

  const copyCode = async () => {
    if (!code?.code) return;
    try {
      await navigator.clipboard.writeText(code.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Clipboard access was blocked by the browser.');
    }
  };

  return (
    <div className="flex animate-fade-in gap-3">
      <div className="mt-0.5 shrink-0">
        <SakiLogo size={30} animated={speakingThis} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="mb-1 flex items-center gap-2 text-xs text-ink-400">
          <span className="font-semibold text-ink-200">Saki</span>
          <span>{time}</span>
          {message.remote && (
            <span className="flex items-center gap-1">
              <Smartphone className="h-3 w-3" /> asked from your phone
            </span>
          )}
        </p>
        <p className={`text-[15px] leading-relaxed text-ink-100 ${isSinhala ? 'sinhala' : ''}`} lang={isSinhala ? 'si' : 'en'}>
          {shown}
          {!done && <span className="saki-caret" aria-hidden="true" />}
        </p>

        {/* The rest appears once the answer has finished typing. */}
        {done && (
          <div className={message.fresh ? 'animate-fade-in' : undefined}>
            {code?.explanationMarkdown && (
              <div className={`saki-markdown mt-3 ${isSinhala ? 'sinhala' : ''}`}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{code.explanationMarkdown}</ReactMarkdown>
              </div>
            )}

            {/* Voice comes after the whole written answer, just above the code file. */}
            <AudioPlayer messageId={message.id} />

            {hasCode && (
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-ink-700 bg-ink-850 px-3 py-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-saki-500/15">
                  <FileCode2 className="h-4 w-4 text-saki-400" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-sm text-ink-100">{code!.fileName ?? 'snippet'}</span>
                  <span className="block text-[11px] text-ink-400">
                    {code!.code!.split('\n').length} lines · added to the editor
                  </span>
                </span>
                <button type="button" className="icon-btn h-8 w-8" onClick={copyCode} aria-label="Copy code" title="Copy code">
                  {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </button>
                <button type="button" className="btn-secondary px-2.5 py-1.5 text-xs" onClick={openInEditor}>
                  Open in editor
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
