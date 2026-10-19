import { useEffect, useState } from 'react';
import { Smartphone } from 'lucide-react';

const TEXT_STEPS = ['Thinking', 'Reading your code', 'Working out the answer', 'Writing code', 'Preparing the answer'];
const VOICE_STEPS = ['Listening to your question', 'Transcribing', 'Thinking', 'Writing code', 'Preparing the answer'];

/** Heights of Saki's five logo bars (same shape as SakiLogo). */
const BARS = [0.38, 0.85, 0.6, 1, 0.32];

interface Props {
  mode: 'VOICE' | 'TEXT';
  /** Epoch ms the question was sent. */
  since: number;
  /** The question came from another device (the phone). */
  remote?: boolean;
}

/**
 * Saki's own "working on it" animation: the five voice bars of Saki's logo ripple like a
 * thought forming, inside an orbiting teal-violet ring, next to a shimmering status line.
 */
export function ThinkingIndicator({ mode, since, remote = false }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(clock);
  }, []);

  const elapsed = Math.max(0, Math.floor((now - since) / 1000));
  const steps = mode === 'VOICE' ? VOICE_STEPS : TEXT_STEPS;
  // Move through the steps over time, then stay on the last one.
  const step = steps[Math.min(steps.length - 1, Math.floor(elapsed / 3))];

  return (
    <div className="flex animate-fade-in items-center gap-3 py-1" role="status" aria-live="polite">
      <div className="saki-think-orb" aria-hidden="true">
        <span className="saki-think-ring" />
        <span className="saki-think-core">
          {BARS.map((height, i) => (
            <span
              key={i}
              className="saki-think-bar"
              style={{ height: `${height * 100}%`, animationDelay: `${i * 0.11}s` }}
            />
          ))}
        </span>
      </div>

      <div className="flex min-w-0 items-baseline gap-2">
        {remote && <Smartphone className="h-3.5 w-3.5 shrink-0 self-center text-iris-400" aria-hidden="true" />}
        <span key={step} className="saki-think-text animate-fade-in truncate text-sm font-medium">
          {remote ? 'Your phone asked Saki · ' : ''}
          {step}
        </span>
        <span className="saki-think-dots text-saki-400" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className="shrink-0 text-xs text-ink-400 tabular-nums">{elapsed}s</span>
      </div>
    </div>
  );
}
