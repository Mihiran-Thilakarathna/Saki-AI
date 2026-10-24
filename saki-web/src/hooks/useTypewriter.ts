import { useEffect, useMemo, useState } from 'react';

/** Answers that already finished typing, so they show in full when the chat is opened again. */
const typed = new Set<string>();

const TICK_MS = 30;
/** Long answers type faster, so none takes much longer than this. */
const TARGET_MS = 2800;

function splitWords(text: string): string[] {
  // Word segments keep Sinhala letters and their vowel signs together.
  if ('Segmenter' in Intl) {
    return Array.from(new Intl.Segmenter(undefined, { granularity: 'word' }).segment(text), (s) => s.segment);
  }
  return text.split(/(\s+)/);
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * Reveals `text` a few words at a time, like Saki typing it. Only runs once per `id` and only
 * when `enabled` (live answers, not chat history); otherwise the full text is shown at once.
 */
export function useTypewriter(id: string, text: string, enabled: boolean) {
  const words = useMemo(() => splitWords(text), [text]);
  const animate = enabled && !typed.has(id) && !reducedMotion();
  const [count, setCount] = useState(animate ? 0 : words.length);

  useEffect(() => {
    if (!animate) return;
    const step = Math.max(1, Math.ceil(words.length / (TARGET_MS / TICK_MS)));
    const timer = window.setInterval(() => {
      setCount((current) => {
        const next = Math.min(words.length, current + step);
        if (next >= words.length) {
          typed.add(id);
          window.clearInterval(timer);
        }
        return next;
      });
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [animate, id, words]);

  const done = count >= words.length;
  return { shown: done ? text : words.slice(0, count).join(''), done };
}
