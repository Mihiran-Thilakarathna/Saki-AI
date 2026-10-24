import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { ArrowUp, Ear, FileCode2, Loader2, Mic, MicOff, Paperclip, Pause, Play, Square, X } from 'lucide-react';
import { Waveform } from '@/components/Waveform';
import { importCodeFile } from '@/hooks/useCodeImport';
import { useSakiVoice } from '@/hooks/useSakiVoice';
import { IMPORT_ACCEPT } from '@/lib/fileImport';
import { useAudioStore } from '@/store/audioStore';
import { useWorkspaceStore } from '@/store/workspaceStore';

/** Holding the mic longer than this turns the press into push-to-talk (release sends). */
const HOLD_THRESHOLD_MS = 450;

function useElapsed(since: number, active: boolean): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [active]);
  const seconds = active && since ? Math.max(0, Math.floor((now - since) / 1000)) : 0;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** The single input area: text, voice, file import, plus the AI disclaimer. */
export function Composer() {
  const voice = useSakiVoice();
  const sendTextQuery = useWorkspaceStore((s) => s.sendTextQuery);
  const editorCode = useWorkspaceStore((s) => s.editorCode);
  const fileName = useWorkspaceStore((s) => s.fileName);
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pressStartedAt = useRef<number | null>(null);
  const elapsed = useElapsed(voice.recordingStartedAt, voice.recording);

  // Grow the textarea with its content (up to max-h).
  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
  }, [text]);

  const onMicPointerDown = () => {
    if (voice.recording) {
      voice.stopRecording();
      pressStartedAt.current = null;
      return;
    }
    if (!voice.canRecord) return;
    pressStartedAt.current = Date.now();
    voice.startRecording();
  };

  const onMicPointerUp = () => {
    const startedAt = pressStartedAt.current;
    pressStartedAt.current = null;
    if (startedAt !== null && Date.now() - startedAt >= HOLD_THRESHOLD_MS) voice.stopRecording();
  };

  const submitText = (event?: FormEvent) => {
    event?.preventDefault();
    const query = text.trim();
    if (!query || voice.thinking) return;
    setText('');
    // The question appears in the chat immediately; failures show a Retry there.
    void sendTextQuery(query);
    textareaRef.current?.focus();
  };

  const onTextKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submitText();
    }
  };

  const lineCount = editorCode ? editorCode.split('\n').length : 0;

  return (
    <div className="shrink-0 px-3 pt-2 pb-3 sm:px-6">
      <div className="mx-auto w-full max-w-3xl">
        <SpeakingBar />

        {lineCount > 0 && !voice.recording && (
          <p className="mb-1.5 flex items-center gap-1.5 px-1 text-xs text-ink-400">
            <FileCode2 className="h-3.5 w-3.5 text-saki-400" />
            Saki can see <span className="font-mono text-ink-200">{fileName}</span> ({lineCount} lines) in the editor
          </p>
        )}

        <div
          className={`card shadow-lg shadow-black/5 transition focus-within:border-saki-500/60 ${
            voice.recording ? 'border-rose-500/50' : ''
          }`}
        >
          {voice.recording ? (
            <div className="px-3 py-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="icon-btn shrink-0"
                  onClick={voice.cancelRecording}
                  aria-label="Cancel recording"
                  title="Cancel (Esc)"
                >
                  <X className="h-5 w-5" />
                </button>
                <span className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-rose-500 tabular-nums">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inset-0 animate-ping rounded-full bg-rose-500/70" />
                    <span className="relative h-2.5 w-2.5 rounded-full bg-rose-500" />
                  </span>
                  {elapsed}
                </span>
                <Waveform active getLevel={voice.getLevel} className="h-10 min-w-0 flex-1" />
                <button
                  type="button"
                  onClick={voice.stopRecording}
                  className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-brand text-white hover:brightness-110 px-4 text-sm font-semibold transition"
                  aria-label="Stop recording and send"
                >
                  <ArrowUp className="h-4 w-4" /> Send
                </button>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pl-12 text-xs">
                {voice.quiet ? (
                  <span className="flex items-center gap-1.5 font-medium text-amber-500" role="alert">
                    <MicOff className="h-3.5 w-3.5" /> Saki can’t hear you. Check that your microphone is on and not muted.
                  </span>
                ) : (
                  <span className="text-ink-300">
                    {voice.handsFree ? 'Listening… Saki sends when you pause.' : 'Listening… speak now, then press Send.'}
                  </span>
                )}
                {voice.micLabel && (
                  <span className="flex min-w-0 items-center gap-1 text-ink-400">
                    <Mic className="h-3 w-3 shrink-0" />
                    <span className="truncate">{voice.micLabel}</span>
                  </span>
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={submitText}>
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onTextKeyDown}
                rows={1}
                maxLength={4000}
                placeholder="Ask Saki about your code…"
                className="sinhala block max-h-48 min-h-[52px] w-full resize-none bg-transparent px-4 pt-3.5 pb-1 text-[15px] text-ink-100 placeholder:text-ink-400 focus:outline-none"
                aria-label="Type a question for Saki"
              />
              <div className="flex items-center gap-1 px-2 pb-2">
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
                  className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm text-ink-300 transition hover:bg-ink-750 hover:text-ink-100"
                  onClick={() => fileInputRef.current?.click()}
                  title="Open a code file in the editor so you can ask Saki about it"
                >
                  <Paperclip className="h-4 w-4" />
                  <span className="hidden sm:inline">Import file</span>
                </button>
                <button
                  type="button"
                  onClick={voice.toggleWakeWord}
                  className={`flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm transition ${
                    voice.wakeEnabled
                      ? 'bg-saki-500/12 text-saki-400'
                      : 'text-ink-300 hover:bg-ink-750 hover:text-ink-100'
                  }`}
                  aria-pressed={voice.wakeEnabled}
                  title={
                    voice.wakeSupported
                      ? 'Hands-free: say "Hey Saki" to start talking (Chrome / Edge)'
                      : 'Hands-free mode needs Chrome or Edge'
                  }
                >
                  <Ear className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {voice.wakeEnabled ? (voice.wakeListening ? 'Hey Saki: on' : 'Hey Saki: paused') : 'Hey Saki'}
                  </span>
                </button>

                <div className="ml-auto flex items-center gap-1.5">
                  <button
                    type="button"
                    onPointerDown={onMicPointerDown}
                    onPointerUp={onMicPointerUp}
                    onPointerLeave={onMicPointerUp}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        voice.toggleRecording();
                      }
                    }}
                    disabled={!voice.canRecord}
                    className="relative flex h-10 w-10 touch-none items-center justify-center rounded-full border border-ink-700 text-ink-200 transition select-none hover:border-saki-500 hover:text-saki-400 disabled:opacity-40"
                    aria-label="Talk to Saki"
                    title="Click to talk, or hold to talk (Alt+S)"
                  >
                    {voice.wakeListening && (
                      <span className="absolute inset-0 animate-pulse-ring rounded-full bg-saki-500/25" />
                    )}
                    <Mic className="relative h-[18px] w-[18px]" />
                  </button>
                  <button
                    type="submit"
                    disabled={!text.trim() || voice.thinking}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-white hover:brightness-110 transition disabled:bg-none disabled:bg-ink-700 disabled:text-ink-400"
                    aria-label="Send to Saki"
                    title="Send (Enter)"
                  >
                    {voice.thinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-[18px] w-[18px]" />}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>

        <p className="mt-2 text-center text-[11px] text-ink-400">
          Saki is AI and can make mistakes. Please double-check responses.
        </p>
      </div>
    </div>
  );
}

/** Always-visible playback controls while Saki is talking. */
function SpeakingBar() {
  const playback = useAudioStore((s) => s.playback);
  const pause = useAudioStore((s) => s.pause);
  const resume = useAudioStore((s) => s.resume);
  const stop = useAudioStore((s) => s.stop);
  if (playback === 'idle') return null;
  const playing = playback === 'playing';

  return (
    <div className="mb-2 flex justify-center">
      <div className="flex animate-fade-in items-center gap-1 rounded-full border border-saki-500/40 bg-ink-850 py-1 pr-1 pl-3.5 text-sm shadow-md">
        {playing ? (
          <span className="mr-1 flex h-3.5 items-end gap-0.5" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className="h-3.5 w-0.5 origin-bottom animate-bar rounded-full bg-saki-400"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </span>
        ) : null}
        <span className="mr-1 text-ink-200">{playing ? 'Saki is speaking' : 'Paused'}</span>
        <button
          type="button"
          onClick={playing ? pause : resume}
          className="flex h-8 items-center gap-1 rounded-full bg-brand text-white hover:brightness-110 px-3 text-xs font-semibold"
        >
          {playing ? (
            <>
              <Pause className="h-3.5 w-3.5 fill-current" /> Pause
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5 fill-current" /> Resume
            </>
          )}
        </button>
        <button
          type="button"
          onClick={stop}
          className="flex h-8 items-center gap-1 rounded-full px-3 text-xs font-semibold text-ink-200 hover:bg-ink-750"
        >
          <Square className="h-3 w-3 fill-current" /> Stop
        </button>
      </div>
    </div>
  );
}
