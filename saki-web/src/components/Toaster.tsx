import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useToastStore } from '@/store/toastStore';

const ICONS = {
  info: <Info className="h-4 w-4 text-saki-400" />,
  success: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  error: <XCircle className="h-4 w-4 text-rose-500" />,
};

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div
      className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(92vw,380px)] flex-col gap-2"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === 'error' ? 'alert' : 'status'}
          className="pointer-events-auto flex animate-fade-in items-start gap-3 rounded-xl border border-ink-700 bg-ink-850/95 px-4 py-3 text-sm shadow-2xl backdrop-blur"
        >
          <span className="mt-0.5">{ICONS[t.kind]}</span>
          <p className="flex-1 text-ink-100">{t.message}</p>
          {t.action && (
            <button
              type="button"
              className="rounded-md bg-saki-500/15 px-2 py-0.5 text-xs font-semibold text-saki-300 hover:bg-saki-500/25"
              onClick={() => {
                t.action!.run();
                dismiss(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
          <button type="button" className="text-ink-400 hover:text-ink-100" onClick={() => dismiss(t.id)} aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
