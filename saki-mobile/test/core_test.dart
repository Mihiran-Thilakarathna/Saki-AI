import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:saki_mobile/core/config.dart';
import 'package:saki_mobile/core/languages.dart';
import 'package:saki_mobile/core/wake_word_matcher.dart';
import 'package:saki_mobile/core/wav.dart';
import 'package:saki_mobile/models/models.dart';

void main() {
  group('pcm16ToWav', () {
    test('writes a valid 44-byte RIFF header', () {
      final pcm = Uint8List(32000); // 1 s of 16 kHz mono silence
      final wav = pcm16ToWav(pcm, sampleRate: 16000, channels: 1);
      final header = ByteData.sublistView(wav, 0, 44);

      expect(wav.length, 44 + pcm.length);
      expect(String.fromCharCodes(wav.sublist(0, 4)), 'RIFF');
      expect(String.fromCharCodes(wav.sublist(8, 12)), 'WAVE');
      expect(String.fromCharCodes(wav.sublist(36, 40)), 'data');
      expect(header.getUint32(4, Endian.little), 36 + pcm.length);
      expect(header.getUint16(22, Endian.little), 1);
      expect(header.getUint32(24, Endian.little), 16000);
      expect(header.getUint32(28, Endian.little), 32000);
      expect(header.getUint32(40, Endian.little), pcm.length);
    });

    test('measures level and duration', () {
      final loud = ByteData(4)
        ..setInt16(0, 16384, Endian.little)
        ..setInt16(2, -16384, Endian.little);
      expect(pcm16Rms(loud.buffer.asUint8List()), closeTo(0.5, 0.001));
      expect(pcm16Rms(Uint8List(0)), 0);
      expect(pcm16Duration(32000, sampleRate: 16000, channels: 1), const Duration(seconds: 1));
    });
  });

  group('detectWakeWord', () {
    const positives = ['hey saki', 'Hey Sakhi, write a filter', 'hello sucky', 'ok saki', 'හේයි සකි'];
    const negatives = ['I like sake', 'a sake bottle', 'hey there', 'the socket closed'];

    for (final phrase in positives) {
      test('matches "$phrase"', () => expect(detectWakeWord(phrase), isTrue));
    }
    for (final phrase in negatives) {
      test('ignores "$phrase"', () => expect(detectWakeWord(phrase), isFalse));
    }
  });

  test('normalizes server URLs', () {
    expect(normalizeServerUrl(' 192.168.1.20:8080/ '), 'http://192.168.1.20:8080');
    expect(normalizeServerUrl('https://saki.example.lk'), 'https://saki.example.lk');
    expect(webSocketUrlFor('https://saki.example.lk'), 'wss://saki.example.lk/ws');
    expect(webSocketUrlFor('http://10.0.2.2:8080'), 'ws://10.0.2.2:8080/ws');
  });

  test('maps Monaco language ids to highlight ids', () {
    expect(highlightLanguage('java'), 'java');
    expect(highlightLanguage('csharp'), 'cs');
    expect(highlightLanguage('html'), 'xml');
    expect(highlightLanguage('TSX'), 'typescript');
    expect(highlightLanguage('brainfork'), 'plaintext');
    expect(highlightLanguage(null), 'plaintext');
  });

  group('models', () {
    test('parses a Saki response and splits it into chat entries', () {
      final response = SakiResponse.fromJson({
        'sessionId': 's1',
        'messageId': 'm1',
        'userTranscript': 'හේයි සකි, JWT filter එකක් හදන්න',
        'detectedLanguage': 'si-LK',
        'spokenResponse': 'හරි යාළුවා!',
        'audioBase64': null,
        'audioMimeType': null,
        'codePayload': {
          'hasCode': true,
          'programmingLanguage': 'java',
          'fileName': 'JwtFilter.java',
          'code': 'class JwtFilter {}',
          'explanationMarkdown': '- filter',
        },
        'timestamp': '2026-10-18T12:00:00Z',
        'originClientId': 'web-1',
      });

      final entries = ChatEntry.fromResponse(response, fromOtherDevice: true);
      expect(entries, hasLength(2));
      expect(entries.first.fromSaki, isFalse);
      expect(entries.first.isSinhala, isTrue);
      expect(entries.last.id, 'm1');
      expect(entries.last.code.hasRenderableCode, isTrue);
      expect(entries.last.fromOtherDevice, isTrue);
    });

    test('parses a pending-audio answer and the voice that follows', () {
      final response = SakiResponse.fromJson({
        'sessionId': 's1',
        'messageId': 'm2',
        'spokenResponse': 'The code is in the editor.',
        'audioBase64': null,
        'audioPending': true,
        'codePayload': {'hasCode': false},
        'timestamp': '2026-10-19T12:00:00Z',
      });
      expect(response.audioPending, isTrue);
      expect(response.audioBase64, isNull);

      final audio = SakiAudio.fromJson({
        'sessionId': 's1',
        'messageId': 'm2',
        'audioBase64': 'QUJD',
        'audioMimeType': 'audio/mpeg',
        'originClientId': 'phone-1',
      });
      expect(audio.messageId, 'm2');
      expect(audio.audioBase64, 'QUJD');
      expect(SakiAudio.fromJson({'sessionId': 's1', 'messageId': 'm3', 'audioBase64': null}).audioBase64, isNull);
    });

    test('maps history messages and treats blank code as no code', () {
      final history = [
        ConversationMessage.fromJson({
          'id': 'u1',
          'senderRole': 'USER',
          'userTranscript': 'Hey Saki',
          'detectedLanguage': 'en-US',
          'createdAt': '2026-10-18T12:00:00Z',
        }),
        ConversationMessage.fromJson({
          'id': 'a1',
          'senderRole': 'SAKI',
          'spokenResponse': 'Hello!',
          'detectedLanguage': 'en-US',
          'codeSnippet': null,
          'createdAt': '2026-10-18T12:00:01Z',
        }),
      ];
      final entries = ChatEntry.fromHistory(history);
      expect(entries.map((e) => e.text), ['Hey Saki', 'Hello!']);
      expect(entries.last.code.hasRenderableCode, isFalse);
    });

    test('session event types', () {
      final event = SessionEvent.fromJson({'type': 'PROCESSING', 'sessionId': 's1', 'inputMode': 'TEXT'});
      expect(event.type, SessionEventType.processing);
      expect(SessionEvent.fromJson({'type': 'FAILED', 'sessionId': 's1'}).type, SessionEventType.failed);
    });
  });
}
