import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_RECORDING_MS } from '@/config';

export type RecorderState = 'idle' | 'starting' | 'recording';

export interface StartOptions {
  /** Hands-free mode: stop automatically after the user stops talking. */
  autoStopOnSilence?: boolean;
}

interface Options {
  onComplete: (audio: Blob, durationMs: number) => void;
  onError: (message: string) => void;
}

const PREFERRED_MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
const SPEECH_RMS = 0.045;
const SILENCE_RMS = 0.02;
const TRAILING_SILENCE_MS = 1600;
const NO_SPEECH_TIMEOUT_MS = 7000;
const MIN_DURATION_MS = 500;
/** Below this peak level the recording had no usable sound (muted / wrong microphone). */
const SILENT_PEAK_RMS = 0.006;
/** Input level that counts as "the mic hears something" for the live quiet warning. */
const HEARD_RMS = 0.01;
const QUIET_WARNING_MS = 2500;

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return PREFERRED_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

/**
 * MediaRecorder wrapper with a live input level (for the waveform) and optional
 * voice-activity auto-stop used by the "Hey Saki" hands-free mode.
 */
export function useVoiceRecorder({ onComplete, onError }: Options) {
  const [state, setState] = useState<RecorderState>('idle');
  /** Name of the microphone in use, so the user can see which input is recording. */
  const [micLabel, setMicLabel] = useState<string | null>(null);
  /** Recording but the mic has picked up nothing for a while. */
  const [quiet, setQuiet] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const peakRef = useRef(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const levelRef = useRef(0);
  const rafRef = useRef<number>(0);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const discardRef = useRef(false);
  /** stop()/cancel() pressed while getUserMedia was still pending. */
  const pendingStopRef = useRef<'stop' | 'cancel' | null>(null);
  const callbacks = useRef({ onComplete, onError });
  callbacks.current = { onComplete, onError };

  const cleanup = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
    analyserRef.current = null;
    levelRef.current = 0;
    recorderRef.current = null;
    setQuiet(false);
  }, []);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    else if (!recorder) pendingStopRef.current ??= 'stop';
  }, []);

  const cancel = useCallback(() => {
    discardRef.current = true;
    if (!recorderRef.current) pendingStopRef.current = 'cancel';
    stop();
  }, [stop]);

  const start = useCallback(
    async ({ autoStopOnSilence = false }: StartOptions = {}) => {
      if (recorderRef.current) return;
      pendingStopRef.current = null;
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        callbacks.current.onError('This browser cannot record audio. Try Chrome, Edge or Firefox.');
        return;
      }
      setState('starting');
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
        });
      } catch (error) {
        setState('idle');
        const name = (error as DOMException).name;
        callbacks.current.onError(
          name === 'NotAllowedError'
            ? 'Microphone permission was denied. Allow mic access in the address bar to talk to Saki.'
            : 'No microphone was found.',
        );
        return;
      }
      if (pendingStopRef.current === 'cancel') {
        // Released before the mic even opened: treat as an accidental tap.
        stream.getTracks().forEach((track) => track.stop());
        pendingStopRef.current = null;
        setState('idle');
        return;
      }

      streamRef.current = stream;
      setMicLabel(stream.getAudioTracks()[0]?.label || null);
      peakRef.current = 0;
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 64_000 } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];
      discardRef.current = false;

      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      audioContext.createMediaStreamSource(stream).connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const duration = Date.now() - startedAtRef.current;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || 'audio/webm' });
        const discard = discardRef.current;
        cleanup();
        setState('idle');
        if (discard) return;
        if (duration < MIN_DURATION_MS || blob.size < 1024) {
          callbacks.current.onError('That was too short. Hold the mic a little longer.');
          return;
        }
        if (peakRef.current < SILENT_PEAK_RMS) {
          const label = stream.getAudioTracks()[0]?.label;
          callbacks.current.onError(
            `Saki couldn't hear anything${label ? ` from "${label}"` : ''}. ` +
              'Check that your microphone is not muted and is the selected input, then try again.',
          );
          return;
        }
        callbacks.current.onComplete(blob, duration);
      };

      startedAtRef.current = Date.now();
      setStartedAt(startedAtRef.current);
      recorder.start(250);
      setState('recording');
      if (pendingStopRef.current === 'stop') {
        pendingStopRef.current = null;
        discardRef.current = true; // Too short to contain a question.
        recorder.stop();
        return;
      }

      // Level meter + voice activity detection.
      const samples = new Float32Array(analyser.fftSize);
      let heardSpeech = false;
      let silenceSince = 0;
      let lastHeardAt = Date.now();
      let quietShown = false;
      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getFloatTimeDomainData(samples);
        let sum = 0;
        for (const sample of samples) sum += sample * sample;
        const rms = Math.sqrt(sum / samples.length);
        levelRef.current = rms;
        peakRef.current = Math.max(peakRef.current, rms);

        const now = Date.now();
        if (rms > HEARD_RMS) lastHeardAt = now;
        const isQuiet = now - lastHeardAt > QUIET_WARNING_MS;
        if (isQuiet !== quietShown) {
          quietShown = isQuiet;
          setQuiet(isQuiet);
        }
        const elapsed = now - startedAtRef.current;
        if (elapsed >= MAX_RECORDING_MS) {
          stop();
          return;
        }
        if (autoStopOnSilence) {
          if (rms > SPEECH_RMS) {
            heardSpeech = true;
            silenceSince = 0;
          } else if (heardSpeech && rms < SILENCE_RMS) {
            silenceSince ||= now;
            if (now - silenceSince >= TRAILING_SILENCE_MS) {
              stop();
              return;
            }
          }
          if (!heardSpeech && elapsed >= NO_SPEECH_TIMEOUT_MS) {
            cancel();
            return;
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    [cancel, cleanup, stop],
  );

  useEffect(
    () => () => {
      discardRef.current = true;
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      cleanup();
    },
    [cleanup],
  );

  const getLevel = useCallback(() => levelRef.current, []);

  return { state, start, stop, cancel, getLevel, micLabel, quiet, startedAt };
}
