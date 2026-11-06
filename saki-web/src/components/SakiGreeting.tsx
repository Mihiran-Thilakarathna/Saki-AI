import { useEffect, useMemo, useState } from 'react';

const LINES = ['Hi, I’m Saki! 👋', 'Ask me anything.', 'I’ll write the code.'];

const TYPE_MS = 55;
const ERASE_MS = 28;
const HOLD_MS = 1900;
const NEXT_MS = 350;

/** Splits into user-visible characters, so emoji never break apart. */
function characters(text: string): string[] {
  if ('Segmenter' in Intl) {
    return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), (s) => s.segment);
  }
  return Array.from(text);
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** Saki's speech bubble on the sign-in page: types a greeting, holds it, erases it and moves on. */
export function SakiGreeting({ className = '' }: { className?: string }) {
  const lines = useMemo(() => LINES.map(characters), []);
  const still = useMemo(reducedMotion, []);
  const [line, setLine] = useState(0);
  const [count, setCount] = useState(still ? lines[0].length : 0);
  const [erasing, setErasing] = useState(false);

  useEffect(() => {
    if (still) return;
    const full = lines[line].length;
    let delay: number;
    let step: () => void;
    if (!erasing && count < full) {
      delay = TYPE_MS;
      step = () => setCount((c) => c + 1);
    } else if (!erasing) {
      delay = HOLD_MS;
      step = () => setErasing(true);
    } else if (count > 0) {
      delay = ERASE_MS;
      step = () => setCount((c) => c - 1);
    } else {
      delay = NEXT_MS;
      step = () => {
        setErasing(false);
        setLine((l) => (l + 1) % lines.length);
      };
    }
    const timer = window.setTimeout(step, delay);
    return () => window.clearTimeout(timer);
  }, [still, lines, line, count, erasing]);

  const text = lines[line].slice(0, count).join('');

  return (
    <div className={`saki-greeting ${className}`} aria-live="polite">
      <span className="saki-greeting-dot" aria-hidden="true" />
      <span className="min-h-[1.5em] leading-snug">
        {text}
        <span className="saki-caret" aria-hidden="true" />
      </span>
    </div>
  );
}
