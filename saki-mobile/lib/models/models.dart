// Dart mirrors of the saki-backend DTOs.

typedef Json = Map<String, dynamic>;

String? _str(Object? value) => value as String?;
DateTime _date(Object? value) => DateTime.tryParse(value as String? ?? '')?.toLocal() ?? DateTime.now();

class UserProfile {
  const UserProfile({
    required this.id,
    required this.fullName,
    required this.email,
    required this.preferredLanguage,
  });

  final String id;
  final String fullName;
  final String email;
  final String preferredLanguage;

  factory UserProfile.fromJson(Json json) => UserProfile(
        id: json['id'] as String,
        fullName: json['fullName'] as String? ?? '',
        email: json['email'] as String? ?? '',
        preferredLanguage: json['preferredLanguage'] as String? ?? 'si-LK',
      );

  Json toJson() => {'id': id, 'fullName': fullName, 'email': email, 'preferredLanguage': preferredLanguage};
}

class AuthSession {
  const AuthSession({required this.token, required this.expiresAt, required this.user});

  final String token;
  final DateTime expiresAt;
  final UserProfile user;

  bool get isExpired => DateTime.now().isAfter(expiresAt);

  factory AuthSession.fromAuthResponse(Json json) => AuthSession(
        token: json['accessToken'] as String,
        expiresAt: DateTime.now().add(Duration(seconds: (json['expiresIn'] as num).toInt())),
        user: UserProfile.fromJson(json['user'] as Json),
      );

  factory AuthSession.fromJson(Json json) => AuthSession(
        token: json['token'] as String,
        expiresAt: DateTime.parse(json['expiresAt'] as String),
        user: UserProfile.fromJson(json['user'] as Json),
      );

  Json toJson() => {'token': token, 'expiresAt': expiresAt.toIso8601String(), 'user': user.toJson()};
}

class SessionSummary {
  const SessionSummary({
    required this.id,
    required this.title,
    required this.activeLanguage,
    required this.updatedAt,
  });

  final String id;
  final String title;
  final String? activeLanguage;
  final DateTime updatedAt;

  factory SessionSummary.fromJson(Json json) => SessionSummary(
        id: json['id'] as String,
        title: json['title'] as String? ?? 'New chat',
        activeLanguage: _str(json['activeLanguage']),
        updatedAt: _date(json['updatedAt']),
      );

  SessionSummary copyWith({String? title, DateTime? updatedAt}) => SessionSummary(
        id: id,
        title: title ?? this.title,
        activeLanguage: activeLanguage,
        updatedAt: updatedAt ?? this.updatedAt,
      );
}

class CodePayload {
  const CodePayload({
    required this.hasCode,
    this.programmingLanguage,
    this.fileName,
    this.code,
    this.explanationMarkdown,
  });

  final bool hasCode;
  final String? programmingLanguage;
  final String? fileName;
  final String? code;
  final String? explanationMarkdown;

  bool get hasRenderableCode => hasCode && (code?.trim().isNotEmpty ?? false);

  factory CodePayload.fromJson(Json? json) {
    if (json == null) return const CodePayload(hasCode: false);
    return CodePayload(
      hasCode: json['hasCode'] as bool? ?? false,
      programmingLanguage: _str(json['programmingLanguage']),
      fileName: _str(json['fileName']),
      code: _str(json['code']),
      explanationMarkdown: _str(json['explanationMarkdown']),
    );
  }
}

class ConversationMessage {
  const ConversationMessage({
    required this.id,
    required this.senderRole,
    required this.userTranscript,
    required this.detectedLanguage,
    required this.spokenResponse,
    required this.code,
    required this.createdAt,
  });

  final String id;
  final String senderRole;
  final String? userTranscript;
  final String? detectedLanguage;
  final String? spokenResponse;
  final CodePayload code;
  final DateTime createdAt;

  factory ConversationMessage.fromJson(Json json) {
    final snippet = _str(json['codeSnippet']);
    return ConversationMessage(
      id: json['id'] as String,
      senderRole: json['senderRole'] as String,
      userTranscript: _str(json['userTranscript']),
      detectedLanguage: _str(json['detectedLanguage']),
      spokenResponse: _str(json['spokenResponse']),
      code: CodePayload(
        hasCode: snippet != null && snippet.isNotEmpty,
        programmingLanguage: _str(json['programmingLanguage']),
        fileName: _str(json['fileName']),
        code: snippet,
        explanationMarkdown: _str(json['explanationMarkdown']),
      ),
      createdAt: _date(json['createdAt']),
    );
  }
}

class SakiResponse {
  const SakiResponse({
    required this.sessionId,
    required this.messageId,
    required this.userTranscript,
    required this.detectedLanguage,
    required this.spokenResponse,
    required this.audioBase64,
    required this.audioMimeType,
    this.audioPending = false,
    required this.codePayload,
    required this.timestamp,
    required this.originClientId,
  });

  final String sessionId;
  final String messageId;
  final String userTranscript;
  final String detectedLanguage;
  final String spokenResponse;
  final String? audioBase64;
  final String? audioMimeType;

  /// The voice is still being synthesized; it follows as a [SakiAudio] over WebSocket.
  final bool audioPending;
  final CodePayload codePayload;
  final DateTime timestamp;
  final String? originClientId;

  factory SakiResponse.fromJson(Json json) => SakiResponse(
        sessionId: json['sessionId'] as String,
        messageId: json['messageId'] as String,
        userTranscript: json['userTranscript'] as String? ?? '',
        detectedLanguage: json['detectedLanguage'] as String? ?? 'en-US',
        spokenResponse: json['spokenResponse'] as String? ?? '',
        audioBase64: _str(json['audioBase64']),
        audioMimeType: _str(json['audioMimeType']),
        audioPending: json['audioPending'] == true,
        codePayload: CodePayload.fromJson(json['codePayload'] as Json?),
        timestamp: _date(json['timestamp']),
        originClientId: _str(json['originClientId']),
      );
}

/// Voice for an earlier answer, from `/topic/session/{id}/audio` (null audio = TTS failed).
class SakiAudio {
  const SakiAudio({required this.sessionId, required this.messageId, this.audioBase64, this.audioMimeType});

  final String sessionId;
  final String messageId;
  final String? audioBase64;
  final String? audioMimeType;

  factory SakiAudio.fromJson(Json json) => SakiAudio(
        sessionId: json['sessionId'] as String,
        messageId: json['messageId'] as String,
        audioBase64: _str(json['audioBase64']),
        audioMimeType: _str(json['audioMimeType']),
      );
}

enum SessionEventType { processing, completed, failed }

class SessionEvent {
  const SessionEvent({
    required this.type,
    required this.sessionId,
    required this.inputMode,
    required this.originClientId,
    required this.message,
  });

  final SessionEventType type;
  final String sessionId;
  final String inputMode;
  final String? originClientId;
  final String? message;

  factory SessionEvent.fromJson(Json json) => SessionEvent(
        type: switch (json['type']) {
          'PROCESSING' => SessionEventType.processing,
          'COMPLETED' => SessionEventType.completed,
          _ => SessionEventType.failed,
        },
        sessionId: json['sessionId'] as String,
        inputMode: json['inputMode'] as String? ?? 'VOICE',
        originClientId: _str(json['originClientId']),
        message: _str(json['message']),
      );
}

/// One bubble in the conversation UI (history from the server or a live answer).
class ChatEntry {
  const ChatEntry({
    required this.id,
    required this.fromSaki,
    required this.text,
    required this.language,
    required this.code,
    required this.createdAt,
    this.fromOtherDevice = false,
  });

  final String id;
  final bool fromSaki;
  final String text;
  final String? language;
  final CodePayload code;
  final DateTime createdAt;
  final bool fromOtherDevice;

  bool get isSinhala => language == 'si-LK';

  static List<ChatEntry> fromHistory(List<ConversationMessage> messages) => [
        for (final m in messages)
          ChatEntry(
            id: m.id,
            fromSaki: m.senderRole == 'SAKI',
            text: (m.senderRole == 'SAKI' ? m.spokenResponse : m.userTranscript) ?? '',
            language: m.detectedLanguage,
            code: m.senderRole == 'SAKI' ? m.code : const CodePayload(hasCode: false),
            createdAt: m.createdAt,
          ),
      ];

  static List<ChatEntry> fromResponse(SakiResponse r, {required bool fromOtherDevice}) => [
        ChatEntry(
          id: '${r.messageId}-q',
          fromSaki: false,
          text: r.userTranscript,
          language: r.detectedLanguage,
          code: const CodePayload(hasCode: false),
          createdAt: r.timestamp,
          fromOtherDevice: fromOtherDevice,
        ),
        ChatEntry(
          id: r.messageId,
          fromSaki: true,
          text: r.spokenResponse,
          language: r.detectedLanguage,
          code: r.codePayload,
          createdAt: r.timestamp,
          fromOtherDevice: fromOtherDevice,
        ),
      ];
}
