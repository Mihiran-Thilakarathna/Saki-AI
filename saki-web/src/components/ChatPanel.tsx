import { useEffect, useRef } from 'react';
import { Bug, Code2, FileCode2, Keyboard, Loader2, Mic, Paperclip } from 'lucide-react';
import { Composer } from '@/components/Composer';
import { MessageBubble } from '@/components/MessageBubble';
import { SakiLogo } from '@/components/SakiLogo';
import { ThinkingIndicator } from '@/components/ThinkingIndicator';
import { useWorkspaceStore } from '@/store/workspaceStore';

const SUGGESTIONS = [
  { icon: Code2, text: 'Implement JWT authentication in a Spring Boot REST API', sinhala: false },
  { icon: FileCode2, text: 'React වල useState සහ useEffect අතර වෙනස පැහැදිලි කරන්න', sinhala: true },
  { icon: Bug, text: 'Explain the common causes of a NullPointerException and how to fix them', sinhala: false },
];

const HOW_IT_WORKS = [
  { icon: Mic, title: 'Talk', text: 'Click the mic and ask in Sinhala or English.' },
  { icon: Keyboard, title: 'Type', text: 'Or type your question and press Enter.' },
  { icon: Paperclip, title: 'Import', text: 'Open your own file and ask about it.' },
];

export function ChatPanel({ onShowEditor }: { onShowEditor: () => void }) {
  const messages = useWorkspaceStore((s) => s.messages);
  const sessionLoading = useWorkspaceStore((s) => s.sessionLoading);
  const thinking = useWorkspaceStore((s) => s.thinking);
  const thinkingSince = useWorkspaceStore((s) => s.thinkingSince);
  const thinkingMode = useWorkspaceStore((s) => s.thinkingMode);
  const remoteActivity = useWorkspaceStore((s) => s.remoteActivity);
  const sendTextQuery = useWorkspaceStore((s) => s.sendTextQuery);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMessage = messages[messages.length - 1];

  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
  }, [messages.length, lastMessage?.status, lastMessage?.text, thinking, remoteActivity]);

  const empty = !sessionLoading && messages.length === 0 && !thinking && !remoteActivity;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6">
          {sessionLoading && (
            <div className="flex justify-center py-16 text-ink-400">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}

          {empty && (
            <div className="flex animate-fade-in flex-col items-center pt-6 text-center sm:pt-12">
              <div className="relative">
                <div className="bg-brand-mesh pointer-events-none absolute -inset-16 opacity-60 blur-2xl dark:opacity-70" />
                <div className="relative">
                  <SakiLogo size={96} />
                </div>
              </div>
              <h2 className="mt-5 text-2xl font-semibold tracking-tight">How can I help with your code?</h2>
              <p className="mt-2 max-w-md text-sm text-ink-300">
                Ask by voice or text in Sinhala or English. Saki explains the answer aloud and puts the complete
                code in the editor.
              </p>

              <div className="mt-8 grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
                {HOW_IT_WORKS.map(({ icon: Icon, title, text }) => (
                  <div key={title} className="card flex items-start gap-3 p-3.5 text-left">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-saki-500/12 text-saki-400">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-ink-100">{title}</span>
                      <span className="block text-xs text-ink-400">{text}</span>
                    </span>
                  </div>
                ))}
              </div>

              <p className="mt-8 w-full text-left text-xs font-semibold tracking-wide text-ink-400 uppercase">
                Try asking
              </p>
              <div className="mt-2 w-full space-y-2">
                {SUGGESTIONS.map(({ icon: Icon, text, sinhala }) => (
                  <button
                    key={text}
                    type="button"
                    onClick={() => void sendTextQuery(text)}
                    className={`group flex w-full items-center gap-3 rounded-xl border border-ink-700 bg-ink-850 px-4 py-3 text-left text-sm text-ink-200 transition hover:border-saki-500/60 hover:bg-ink-800 hover:text-ink-100 ${
                      sinhala ? 'sinhala' : ''
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-ink-400 transition group-hover:text-saki-400" />
                    {text}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} onOpenCode={onShowEditor} />
          ))}

          {thinking && thinkingSince && thinkingMode && <ThinkingIndicator mode={thinkingMode} since={thinkingSince} />}
          {!thinking && remoteActivity && (
            <ThinkingIndicator mode={remoteActivity.inputMode} since={remoteActivity.since} remote />
          )}
        </div>
      </div>
      <Composer />
    </div>
  );
}
