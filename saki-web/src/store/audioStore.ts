import { create } from 'zustand';
import { toast } from '@/store/toastStore';
import type { SakiAudio, SakiLanguage, SakiResponse } from '@/types/api';

interface CachedClip {
  src: string;
  text: string;
  language: SakiLanguage;
  /** Voice still being synthesized on the server; play it as soon as it arrives. */
  awaitingAudio?: boolean;
}

export type PlaybackState = 'idle' | 'playing' | 'paused';

interface AudioState {
  /** Message whose voice is loaded in the player (playing or paused). */
  currentMessageId: string | null;
  playback: PlaybackState;
  /** Seconds; 0 when unknown (browser speech fallback). */
  position: number;
  duration: number;
  muted: boolean;
  lastMessageId: string | null;
  /** messageIds whose audio can be played this session (history from the server has no audio). */
  replayable: Record<string, true>;
  /** messageIds whose voice is still being prepared on the server. */
  preparing: Record<string, true>;

  /** Derived: true while audio is audibly playing. */
  speaking: boolean;
  speakingMessageId: string | null;

  playResponse: (response: SakiResponse) => void;
  /** Voice that arrived after its answer (async TTS). */
  receiveAudio: (audio: SakiAudio) => void;
  play: (messageId?: string) => void;
  replay: (messageId?: string) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  seek: (fraction: number) => void;
  toggleMute: () => void;
}

const MUTE_KEY = 'saki-muted';
const clips = new Map<string, CachedClip>();
/** Audio that arrived before its answer was shown (rare WebSocket/HTTP race). */
const earlyAudio = new Map<string, SakiAudio>();
let audioElement: HTMLAudioElement | null = null;
let usingBrowserSpeech = false;

const toSrc = (base64: string, mimeType: string | null) => `data:${mimeType ?? 'audio/mpeg'};base64,${base64}`;

/** Same text the server speaks: the answer plus its explanation points, without code. */
function speechText(response: SakiResponse): string {
  const points = (response.codePayload?.explanationMarkdown ?? '')
    .replace(/```[\s\S]*?```/g, '\n')
    .split('\n')
    .map((line) =>
      line
        .replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '')
        .replace(/`([^`]*)`/g, '$1')
        .replace(/\*\*|__|[*#>~]/g, '')
        .replace(/\(\s*\)/g, '')
        .trim(),
    )
    .filter(Boolean);
  return [response.spokenResponse, ...points].join('. ').replace(/([.!?।])\./g, '$1');
}

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function without(record: Record<string, true>, key: string): Record<string, true> {
  if (!(key in record)) return record;
  const next = { ...record };
  delete next[key];
  return next;
}

/**
 * Plays Saki's server-synthesized MP3 (identical Sinhala/English neural voice on every
 * device) with pause/resume/stop and progress. Falls back to the browser's speechSynthesis
 * when the backend had no TTS audio.
 */
export const useAudioStore = create<AudioState>()((set, get) => {
  const setPlayback = (playback: PlaybackState, messageId: string | null = get().currentMessageId) =>
    set({
      playback,
      currentMessageId: playback === 'idle' ? null : messageId,
      speaking: playback === 'playing',
      speakingMessageId: playback === 'playing' ? messageId : null,
      ...(playback === 'idle' ? { position: 0, duration: 0 } : {}),
    });

  const ensureElement = (): HTMLAudioElement => {
    if (audioElement) return audioElement;
    const element = new Audio();
    element.addEventListener('timeupdate', () => set({ position: element.currentTime }));
    element.addEventListener('loadedmetadata', () =>
      set({ duration: Number.isFinite(element.duration) ? element.duration : 0 }),
    );
    element.addEventListener('ended', () => setPlayback('idle'));
    element.addEventListener('error', () => setPlayback('idle'));
    audioElement = element;
    return element;
  };

  const haltEverything = () => {
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    usingBrowserSpeech = false;
  };

  const speakWithBrowser = (clip: CachedClip, messageId: string) => {
    if (!('speechSynthesis' in window)) return;
    const voice = window.speechSynthesis
      .getVoices()
      .find((v) => v.lang.replace('_', '-').startsWith(clip.language.slice(0, 2)));
    if (!voice) return; // No local Sinhala voice is common; the text is still shown in chat.
    const utterance = new SpeechSynthesisUtterance(clip.text);
    utterance.voice = voice;
    utterance.lang = clip.language;
    utterance.onend = () => setPlayback('idle');
    utterance.onerror = () => setPlayback('idle');
    usingBrowserSpeech = true;
    set({ duration: 0, position: 0 });
    setPlayback('playing', messageId);
    window.speechSynthesis.speak(utterance);
  };

  const playClip = (messageId: string) => {
    const clip = clips.get(messageId);
    if (!clip) return;
    haltEverything();
    setPlayback('idle');
    set({ lastMessageId: messageId });
    if (get().muted) return;

    if (!clip.src) {
      speakWithBrowser(clip, messageId);
      return;
    }
    const element = ensureElement();
    element.src = clip.src;
    set({ position: 0, duration: 0 });
    setPlayback('playing', messageId);
    element.play().catch((error: Error) => {
      setPlayback('idle');
      if (error.name === 'NotAllowedError') {
        // Autoplay blocked: e.g. an answer arrived from the phone before the user touched this tab.
        toast.info('Saki has a voice reply ready.', { label: 'Play', run: () => get().play(messageId) });
      }
    });
  };

  return {
    currentMessageId: null,
    playback: 'idle',
    position: 0,
    duration: 0,
    muted: readMuted(),
    lastMessageId: null,
    replayable: {},
    preparing: {},
    speaking: false,
    speakingMessageId: null,

    playResponse: (response) => {
      const src = response.audioBase64 ? toSrc(response.audioBase64, response.audioMimeType) : '';
      const clip: CachedClip = { src, text: speechText(response), language: response.detectedLanguage };
      clips.set(response.messageId, clip);
      set({ replayable: { ...get().replayable, [response.messageId]: true } });

      const early = earlyAudio.get(response.messageId);
      if (early) {
        earlyAudio.delete(response.messageId);
        if (early.audioBase64) clip.src = toSrc(early.audioBase64, early.audioMimeType);
      } else if (response.audioPending && !src) {
        // The answer is already on screen; Saki starts speaking when the voice arrives.
        clip.awaitingAudio = true;
        set({ lastMessageId: response.messageId, preparing: { ...get().preparing, [response.messageId]: true } });
        return;
      }
      playClip(response.messageId);
    },

    receiveAudio: (audio) => {
      const clip = clips.get(audio.messageId);
      if (!clip) {
        earlyAudio.set(audio.messageId, audio);
        if (earlyAudio.size > 20) earlyAudio.delete(earlyAudio.keys().next().value!);
        return;
      }
      if (audio.audioBase64) clip.src = toSrc(audio.audioBase64, audio.audioMimeType);
      set({ preparing: without(get().preparing, audio.messageId) });
      if (!clip.awaitingAudio) return;
      clip.awaitingAudio = false;
      // Only speak if nothing newer has started meanwhile.
      if (get().lastMessageId === audio.messageId && get().playback === 'idle') playClip(audio.messageId);
    },

    play: (messageId) => {
      const id = messageId ?? get().lastMessageId;
      if (!id) return;
      if (get().muted) get().toggleMute();
      if (get().currentMessageId === id && get().playback === 'paused') {
        get().resume();
        return;
      }
      playClip(id);
    },

    replay: (messageId) => get().play(messageId),

    pause: () => {
      if (get().playback !== 'playing') return;
      if (usingBrowserSpeech) window.speechSynthesis.pause();
      else audioElement?.pause();
      setPlayback('paused');
    },

    resume: () => {
      if (get().playback !== 'paused') return;
      setPlayback('playing');
      if (usingBrowserSpeech) {
        window.speechSynthesis.resume();
        return;
      }
      audioElement?.play().catch(() => setPlayback('idle'));
    },

    stop: () => {
      haltEverything();
      setPlayback('idle');
    },

    seek: (fraction) => {
      const { duration } = get();
      if (!audioElement || usingBrowserSpeech || !duration) return;
      audioElement.currentTime = Math.max(0, Math.min(1, fraction)) * duration;
      set({ position: audioElement.currentTime });
    },

    toggleMute: () => {
      const muted = !get().muted;
      if (muted) get().stop();
      try {
        localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
      } catch {
        // Storage unavailable (private mode): mute still works for this tab.
      }
      set({ muted });
    },
  };
});
