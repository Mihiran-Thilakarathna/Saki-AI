/// "Hey Saki" detection on speech-recognition transcripts. Recognizers rarely spell
/// "Saki" consistently, so common phonetic mis-hearings are accepted, plus the
/// Sinhala-script form "හේයි සකි". Kept in sync with saki-web's lib/wakeWord.ts.
final RegExp _latinWake = RegExp(
  r'\b(?:hey|hay|hei|hi|hello|hallo|ok|okay)[\s,.!]*'
  r"(?:saki|sakhi|sakki|sakey|sakie|saky|sacky|sackie|sachi|sarki|suki|sucky|socky|sockey|saaki|sake|sa key|psaki|saki's)\b",
  caseSensitive: false,
);
final RegExp _sinhalaWake = RegExp(r'(?:හේයි|හෙයි|හලෝ)?\s*සකි');

bool detectWakeWord(String transcript) {
  final normalized = transcript.toLowerCase().replaceAll('-', ' ');
  return _latinWake.hasMatch(normalized) || _sinhalaWake.hasMatch(transcript);
}
