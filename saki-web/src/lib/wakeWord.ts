/**
 * "Hey Saki" detection on browser speech-recognition transcripts. Recognizers rarely
 * spell the name "Saki" consistently, so we accept common phonetic mis-hearings, plus
 * the Sinhala-script form "හේයි සකි".
 */
const GREETING = String.raw`(?:hey|hay|hei|hi|hello|hallo|ok|okay)`;
const NAME = String.raw`(?:saki|sakhi|sakki|sakey|sakie|saky|sacky|sackie|sachi|sarki|suki|sucky|socky|sockey|saaki|sake|sa key|psaki|saki's)`;
const LATIN_WAKE = new RegExp(String.raw`\b${GREETING}[\s,.!]*${NAME}\b`, 'i');
const SINHALA_WAKE = /(?:හේයි|හෙයි|හලෝ)?\s*සකි/u;

export function detectWakeWord(transcript: string): boolean {
  const normalized = transcript.toLowerCase().replace(/[-]/g, ' ');
  return LATIN_WAKE.test(normalized) || SINHALA_WAKE.test(transcript);
}

export function isWakeWordSupported(): boolean {
  return typeof window !== 'undefined' && Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition);
}
