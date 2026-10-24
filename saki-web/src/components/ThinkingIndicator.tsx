import { useEffect, useState } from 'react';
import { Code2, Smartphone } from 'lucide-react';

const TEXT_STEPS = ['Thinking', 'Reading your code', 'Writing code', 'Preparing the answer'];
const VOICE_STEPS = ['Understanding your voice', 'Thinking', 'Writing code', 'Preparing the answer'];
const DETAILS = ['Analyzing your request…', 'Generating code…', 'Checking the details…'];

/** Brand gradient stops for the seven dots (cyan -> blue -> indigo -> violet). */
const DOT_COLORS = ['var(--grad-1)', '#3aa5f3', 'var(--grad-2)', '#4f74f4', 'var(--grad-3)', '#865df4', 'var(--grad-4)'];

interface Props {
  mode: 'VOICE' | 'TEXT';
  /** Epoch ms the question was sent. */
  since: number;
  /** The question came from another device (the phone). */
  remote?: boolean;
}

/**
 * Saki's "working on it" state: the robot avatar breathes inside an orbiting gradient arc
 * with a code badge, next to a status line, a wave of gradient dots and the elapsed time.
 */
export function ThinkingIndicator({ mode, since, remote = false }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(clock);
  }, []);

  const elapsed = Math.max(0, Math.floor((now - since) / 1000));
  const steps = mode === 'VOICE' ? VOICE_STEPS : TEXT_STEPS;
  const step = steps[Math.min(steps.length - 1, Math.floor(elapsed / 3))];
  const detail = DETAILS[Math.floor(elapsed / 2.5) % DETAILS.length];

  return (
    <div className="flex animate-fade-in items-center gap-4 py-1" role="status" aria-live="polite">
      <div className="saki-orb" aria-hidden="true">
        <span className="saki-orb-halo" />
        <span className="saki-orb-arc" />
        <span className="saki-orb-spinner">
          <span className="saki-orb-dot" />
        </span>
        <span className="saki-orb-face">
          <img src="/saki-avatar.webp" alt="" draggable={false} />
        </span>
        <span className="saki-orb-badge">
          <Code2 className="h-3 w-3" />
        </span>
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {remote && <Smartphone className="h-3.5 w-3.5 shrink-0 text-iris-400" aria-hidden="true" />}
          <span key={step} className="saki-think-text animate-fade-in truncate text-sm font-semibold">
            {remote ? 'Your phone asked Saki · ' : ''}
            {step}…
          </span>
          <span className="shrink-0 text-xs text-ink-400 tabular-nums">{elapsed}s</span>
        </div>
        <div className="mt-1.5 flex items-center gap-[5px]" aria-hidden="true">
          {DOT_COLORS.map((color, i) => (
            <span key={i} className="saki-wave-dot" style={{ background: color, animationDelay: `${i * 0.11}s` }} />
          ))}
        </div>
        <p key={detail} className="mt-1 animate-fade-in text-xs text-ink-400">
          {detail}
        </p>
      </div>
    </div>
  );
}
