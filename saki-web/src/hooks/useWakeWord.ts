import { useEffect, useRef, useState } from 'react';
import { detectWakeWord, isWakeWordSupported } from '@/lib/wakeWord';

interface Options {
  enabled: boolean;
  /** Temporarily stop listening (while recording, thinking or speaking). */
  paused: boolean;
  onWake: () => void;
  onFatalError: (message: string) => void;
}

const RESTART_DELAY_MS = 250;
const MAX_BACKOFF_MS = 10_000;

/**
 * Background "Hey Saki" listener built on the Web Speech API (continuous mode).
 * Chrome ends continuous sessions periodically, so the recognizer is restarted
 * automatically with backoff while the mode is enabled.
 */
export function useWakeWord({ enabled, paused, onWake, onFatalError }: Options) {
  const supported = isWakeWordSupported();
  const [listening, setListening] = useState(false);
  const callbacks = useRef({ onWake, onFatalError });
  callbacks.current = { onWake, onFatalError };

  const active = supported && enabled && !paused;

  useEffect(() => {
    if (!active) return;
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition!;
    const recognition = new Recognition();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;

    let stopped = false;
    let restartTimer: number | undefined;
    let backoff = RESTART_DELAY_MS;

    recognition.onstart = () => {
      setListening(true);
    };
    recognition.onresult = (event) => {
      backoff = RESTART_DELAY_MS;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        for (let a = 0; a < result.length; a++) {
          if (detectWakeWord(result[a].transcript)) {
            stopped = true;
            recognition.abort();
            setListening(false);
            callbacks.current.onWake();
            return;
          }
        }
      }
    };
    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        stopped = true;
        callbacks.current.onFatalError(
          'Microphone access for "Hey Saki" was blocked. Allow the mic and turn hands-free mode on again.',
        );
      } else if (event.error === 'network') {
        backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
      }
      // 'no-speech' and 'aborted' are routine; onend restarts the recognizer.
    };
    recognition.onend = () => {
      setListening(false);
      if (stopped) return;
      restartTimer = window.setTimeout(() => {
        if (stopped) return;
        try {
          recognition.start();
        } catch {
          // Already started; ignore.
        }
      }, backoff);
    };

    try {
      recognition.start();
    } catch {
      // A previous instance may still be shutting down; onend will retry.
    }

    return () => {
      stopped = true;
      window.clearTimeout(restartTimer);
      recognition.onend = null;
      recognition.abort();
      setListening(false);
    };
  }, [active]);

  return { supported, listening: active && listening };
}
