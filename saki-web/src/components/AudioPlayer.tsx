import type { MouseEvent } from 'react';
import { Loader2, Pause, Play, Square, Volume2 } from 'lucide-react';
import { useAudioStore } from '@/store/audioStore';

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** Voice controls for one Saki answer: play/pause, stop, seekable progress and time. */
export function AudioPlayer({ messageId }: { messageId: string }) {
  const replayable = useAudioStore((s) => Boolean(s.replayable[messageId]));
  const preparing = useAudioStore((s) => Boolean(s.preparing[messageId]));
  const isCurrent = useAudioStore((s) => s.currentMessageId === messageId);
  const playback = useAudioStore((s) => (s.currentMessageId === messageId ? s.playback : 'idle'));
  const position = useAudioStore((s) => (s.currentMessageId === messageId ? s.position : 0));
  const duration = useAudioStore((s) => (s.currentMessageId === messageId ? s.duration : 0));
  const play = useAudioStore((s) => s.play);
  const pause = useAudioStore((s) => s.pause);
  const stop = useAudioStore((s) => s.stop);
  const seek = useAudioStore((s) => s.seek);

  if (!replayable) return null;

  if (preparing && !isCurrent) {
    return (
      <div className="mt-3 flex items-center gap-2 text-xs text-ink-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-saki-400" />
        Preparing Saki’s voice…
      </div>
    );
  }

  const playing = playback === 'playing';
  const progress = duration > 0 ? Math.min(1, position / duration) : 0;

  const onSeek = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    seek((event.clientX - rect.left) / rect.width);
  };

  return (
    <div
      className={`mt-3 flex items-center gap-2 rounded-xl border px-2 py-1.5 transition-colors ${
        isCurrent ? 'border-saki-500/40 bg-saki-500/5' : 'border-ink-700 bg-ink-800/60'
      }`}
    >
      <button
        type="button"
        onClick={() => (playing ? pause() : play(messageId))}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-saki-400 to-iris-500 text-white hover:brightness-110 transition"
        aria-label={playing ? 'Pause Saki' : playback === 'paused' ? 'Resume Saki' : 'Play Saki’s answer'}
        title={playing ? 'Pause' : playback === 'paused' ? 'Resume' : 'Play'}
      >
        {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
      </button>
      <button
        type="button"
        onClick={stop}
        disabled={!isCurrent}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-300 transition hover:bg-ink-750 hover:text-ink-100 disabled:opacity-30"
        aria-label="Stop Saki"
        title="Stop"
      >
        <Square className="h-3.5 w-3.5 fill-current" />
      </button>

      {isCurrent && duration > 0 ? (
        <>
          <div
            className="group relative h-6 min-w-0 flex-1 cursor-pointer"
            onClick={onSeek}
            role="slider"
            aria-label="Playback position"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(position)}
          >
            <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-ink-700" />
            <div
              className="absolute top-1/2 left-0 h-1.5 -translate-y-1/2 rounded-full bg-gradient-to-r from-saki-400 to-iris-500"
              style={{ width: `${progress * 100}%` }}
            />
            <div
              className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-saki-500 opacity-0 shadow transition group-hover:opacity-100"
              style={{ left: `${progress * 100}%` }}
            />
          </div>
          <span className="shrink-0 pr-1 text-[11px] text-ink-400 tabular-nums">
            {formatTime(position)} / {formatTime(duration)}
          </span>
        </>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-1.5 pr-1 text-xs text-ink-300">
          {playing ? (
            <>
              <span className="flex h-3 items-end gap-0.5" aria-hidden="true">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className="h-3 w-0.5 origin-bottom animate-bar rounded-full bg-saki-400"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </span>
              Speaking…
            </>
          ) : (
            <>
              <Volume2 className="h-3.5 w-3.5" /> {playback === 'paused' ? 'Paused' : 'Listen to Saki’s answer'}
            </>
          )}
        </span>
      )}
    </div>
  );
}
