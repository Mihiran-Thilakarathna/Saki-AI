import 'dart:typed_data';

import 'package:dio/dio.dart';

import '../models/models.dart';

class ApiException implements Exception {
  const ApiException(this.status, this.code, this.message, [this.fieldErrors = const {}]);

  final int status;
  final String code;
  final String message;
  final Map<String, String> fieldErrors;

  String get displayMessage {
    if (fieldErrors.isEmpty) return message;
    return '$message: ${fieldErrors.values.first}';
  }

  @override
  String toString() => 'ApiException($status, $code): $message';
}

/// REST client for saki-backend. Converts ProblemDetail errors into [ApiException].
class ApiClient {
  ApiClient({
    required String baseUrl,
    required String? Function() tokenProvider,
    required void Function() onUnauthorized,
  }) : _dio = Dio(BaseOptions(
          baseUrl: baseUrl,
          connectTimeout: const Duration(seconds: 10),
          sendTimeout: const Duration(seconds: 60),
          // Gemini + neural TTS can take a while for long code answers.
          receiveTimeout: const Duration(seconds: 120),
          headers: {'Accept': 'application/json'},
        )) {
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        final token = tokenProvider();
        if (token != null && options.extra['auth'] != false) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) {
        if (error.response?.statusCode == 401 && error.requestOptions.extra['auth'] != false) {
          onUnauthorized();
        }
        handler.next(error);
      },
    ));
  }

  final Dio _dio;

  static final Options _public = Options(extra: {'auth': false});

  // ------------------------------------------------------------------ auth

  Future<AuthSession> login(String email, String password) => _call(
        () => _dio.post<Json>('/api/v1/auth/login', data: {'email': email, 'password': password}, options: _public),
        (data) => AuthSession.fromAuthResponse(data as Json),
      );

  Future<AuthSession> register({
    required String fullName,
    required String email,
    required String password,
    required String preferredLanguage,
  }) =>
      _call(
        () => _dio.post<Json>('/api/v1/auth/register',
            data: {
              'fullName': fullName,
              'email': email,
              'password': password,
              'preferredLanguage': preferredLanguage,
            },
            options: _public),
        (data) => AuthSession.fromAuthResponse(data as Json),
      );

  Future<AuthSession> loginWithGoogle(String idToken, {String? preferredLanguage}) => _call(
        () => _dio.post<Json>('/api/v1/auth/google',
            data: {'idToken': idToken, 'preferredLanguage': ?preferredLanguage}, options: _public),
        (data) => AuthSession.fromAuthResponse(data as Json),
      );

  /// The backend's Google web client ID, or null when Google sign-in is disabled there.
  Future<String?> googleClientId() => _call(
        () => _dio.get<Json>('/api/v1/auth/providers', options: _public),
        (data) {
          final json = data as Json;
          final id = json['googleClientId'];
          return json['googleEnabled'] == true && id is String && id.isNotEmpty ? id : null;
        },
      );

  Future<UserProfile> me() => _call(() => _dio.get<Json>('/api/v1/auth/me'), (d) => UserProfile.fromJson(d as Json));

  // ------------------------------------------------------------------ sessions

  Future<List<SessionSummary>> listSessions() => _call(
        () => _dio.get<List<dynamic>>('/api/v1/sessions'),
        (data) => (data as List<dynamic>).map((e) => SessionSummary.fromJson(e as Json)).toList(),
      );

  Future<SessionSummary> createSession({String? title}) => _call(
        () => _dio.post<Json>('/api/v1/sessions', data: {'title': ?title}),
        (data) => SessionSummary.fromJson(data as Json),
      );

  Future<List<ConversationMessage>> messages(String sessionId) => _call(
        () => _dio.get<List<dynamic>>('/api/v1/sessions/$sessionId/messages'),
        (data) => (data as List<dynamic>).map((e) => ConversationMessage.fromJson(e as Json)).toList(),
      );

  // ------------------------------------------------------------------ Saki

  Future<SakiResponse> voiceQuery({
    required String sessionId,
    required Uint8List wavBytes,
    required String clientId,
  }) {
    final form = FormData.fromMap({
      'sessionId': sessionId,
      'clientId': clientId,
      'audioFile': MultipartFile.fromBytes(
        wavBytes,
        filename: 'saki-query.wav',
        contentType: DioMediaType('audio', 'wav'),
      ),
    });
    return _call(
      () => _dio.post<Json>('/api/v1/saki/voice-query', data: form),
      (data) => SakiResponse.fromJson(data as Json),
    );
  }

  Future<SakiResponse> textQuery({
    required String sessionId,
    required String query,
    required String clientId,
  }) =>
      _call(
        () => _dio.post<Json>('/api/v1/saki/text-query',
            data: {'sessionId': sessionId, 'query': query, 'clientId': clientId}),
        (data) => SakiResponse.fromJson(data as Json),
      );

  // ------------------------------------------------------------------ plumbing

  Future<T> _call<T>(Future<Response<dynamic>> Function() request, T Function(dynamic data) parse) async {
    try {
      final response = await request();
      return parse(response.data);
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  ApiException _toApiException(DioException e) {
    final response = e.response;
    if (response == null) {
      final timeout = e.type == DioExceptionType.receiveTimeout || e.type == DioExceptionType.connectionTimeout;
      return ApiException(
        0,
        timeout ? 'TIMEOUT' : 'NETWORK_ERROR',
        timeout
            ? 'Saki took too long to respond. Please try again.'
            : 'Cannot reach the Saki backend at ${_dio.options.baseUrl}. Check the server address and Wi-Fi.',
      );
    }
    final data = response.data;
    if (data is Map<String, dynamic>) {
      final fields = (data['fieldErrors'] as Map<String, dynamic>?)?.map((k, v) => MapEntry(k, '$v')) ?? {};
      return ApiException(
        response.statusCode ?? 0,
        data['errorCode'] as String? ?? 'HTTP_${response.statusCode}',
        data['detail'] as String? ?? 'Request failed',
        fields,
      );
    }
    return ApiException(response.statusCode ?? 0, 'HTTP_${response.statusCode}', 'Request failed');
  }
}
