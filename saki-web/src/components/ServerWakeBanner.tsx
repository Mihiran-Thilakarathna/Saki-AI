import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { API_BASE_URL } from '@/config';

/** Only show the notice if the server has not answered within this time. */
const SHOW_AFTER_MS = 2500;
/** Free hosts can take about a minute to start a sleeping server. */
const GIVE_UP_AFTER_MS = 120_000;

/**
 * On free hosting (e.g. Render) the backend sleeps when idle and needs up to a minute to
 * start. This pings the health endpoint once on load and explains the wait if it is slow.
 */
export function ServerWakeBanner() {
  const [state, setState] = useState<'checking' | 'waking' | 'ready' | 'unreachable'>('checking');

  useEffect(() => {
    let done = false;
    const controller = new AbortController();
    const showTimer = window.setTimeout(() => !done && setState('waking'), SHOW_AFTER_MS);
    const giveUpTimer = window.setTimeout(() => controller.abort(), GIVE_UP_AFTER_MS);

    fetch(`${API_BASE_URL}/actuator/health`, { signal: controller.signal, cache: 'no-store' })
      .then((response) => {
        done = true;
        setState(response.ok ? 'ready' : 'unreachable');
      })
      .catch(() => {
        done = true;
        setState('unreachable');
      })
      .finally(() => {
        window.clearTimeout(showTimer);
        window.clearTimeout(giveUpTimer);
      });

    return () => {
      done = true;
      controller.abort();
      window.clearTimeout(showTimer);
      window.clearTimeout(giveUpTimer);
    };
  }, []);

  if (state === 'checking' || state === 'ready') return null;

  return (
    <div
      className="fixed inset-x-0 top-0 z-[60] flex justify-center px-3 pt-3"
      role="status"
      aria-live="polite"
    >
      <div className="card flex max-w-xl animate-fade-in items-center gap-3 px-4 py-2.5 text-sm shadow-xl">
        {state === 'waking' ? (
          <>
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-saki-400" />
            <span className="text-ink-200">
              Waking up Saki’s server… On free hosting it sleeps when idle, so the first visit can take up to a
              minute.
            </span>
          </>
        ) : (
          <span className="text-rose-500">Saki’s server is not reachable right now. Please try again in a moment.</span>
        )}
      </div>
    </div>
  );
}
