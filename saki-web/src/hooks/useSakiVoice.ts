import { useCallback, useEffect, useState } from 'react';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { useWakeWord } from '@/hooks/useWakeWord';
import { useAudioStore } from '@/store/audioStore';
import { toast } from '@/store/toastStore';
import { useWorkspaceStore } from '@/store/workspaceStore';

const WAKE_KEY = 'saki-wake-word';

function readWakePreference(): boolean {
  try {
    return localStorage.getItem(WAKE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Orchestrates Saki's voice loop for the Web IDE:
 * push-to-talk / toggle mic, optional "Hey Saki" hands-free trigger, barge-in
 * (talking stops Saki's playback) and the Alt+S keyboard shortcut.
 */
export function useSakiVoice() {
  const sendVoiceQuery = useWorkspaceStore((s) => s.sendVoiceQuery);
  const thinking = useWorkspaceStore((s) => s.thinking);
  const hasSession = useWorkspaceStore((s) => Boolean(s.activeSessionId) && !s.sessionLoading);
  const speaking = useAudioStore((s) => s.speaking);
  const [wakeEnabled, setWakeEnabled] = useState(readWakePreference);
  const [handsFree, setHandsFree] = useState(false);

  const recorder = useVoiceRecorder({
    onComplete: (audio, durationMs) => {
      void sendVoiceQuery(audio, durationMs);
    },
    onError: (message) => toast.error(message),
  });
  const recording = recorder.state !== 'idle';

  const startRecording = useCallback(
    (autoStopOnSilence: boolean) => {
      if (!hasSession || thinking) return;
      useAudioStore.getState().stop(); // Barge-in: the user talking interrupts Saki.
      setHandsFree(autoStopOnSilence);
      void recorder.start({ autoStopOnSilence });
    },
    [hasSession, recorder, thinking],
  );

  const toggleRecording = useCallback(() => {
    if (recording) recorder.stop();
    else startRecording(false);
  }, [recorder, recording, startRecording]);

  const wake = useWakeWord({
    enabled: wakeEnabled && hasSession,
    paused: recording || thinking || speaking,
    onWake: () => {
      toast.info('Saki is listening…');
      startRecording(true);
    },
    onFatalError: (message) => {
      setWakeEnabled(false);
      toast.error(message);
    },
  });

  const toggleWakeWord = useCallback(() => {
    if (!wake.supported) {
      toast.error('"Hey Saki" needs the Web Speech API (Chrome or Edge). Push-to-talk still works.');
      return;
    }
    setWakeEnabled((enabled) => {
      const next = !enabled;
      try {
        localStorage.setItem(WAKE_KEY, next ? '1' : '0');
      } catch {
        // Preference just won't persist.
      }
      return next;
    });
  }, [wake.supported]);

  // Alt+S toggles the mic from anywhere, including inside the editor.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && !event.ctrlKey && !event.metaKey && event.code === 'KeyS') {
        event.preventDefault();
        toggleRecording();
      } else if (event.key === 'Escape' && recording) {
        recorder.cancel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [recorder, recording, toggleRecording]);

  return {
    recording,
    handsFree: recording && handsFree,
    thinking,
    speaking,
    canRecord: hasSession && !thinking,
    startRecording: () => startRecording(false),
    stopRecording: recorder.stop,
    cancelRecording: recorder.cancel,
    toggleRecording,
    getLevel: recorder.getLevel,
    micLabel: recorder.micLabel,
    quiet: recorder.quiet,
    recordingStartedAt: recorder.startedAt,
    wakeEnabled,
    wakeSupported: wake.supported,
    wakeListening: wake.listening,
    toggleWakeWord,
  };
}
