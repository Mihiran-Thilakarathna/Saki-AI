import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:stomp_dart_client/stomp_dart_client.dart';

import '../models/models.dart';

enum SyncStatus { disconnected, connecting, connected }

/// Authenticated STOMP connection to saki-backend. Subscribes to the watched
/// session's answer and lifecycle topics and re-subscribes after reconnects, so
/// the phone and the Web IDE stay in lock-step.
class StompSync {
  StompSync({required String wsUrl, required String token}) {
    _client = StompClient(
      config: StompConfig(
        url: wsUrl,
        stompConnectHeaders: {'Authorization': 'Bearer $token'},
        reconnectDelay: const Duration(seconds: 3),
        heartbeatIncoming: const Duration(seconds: 10),
        heartbeatOutgoing: const Duration(seconds: 10),
        connectionTimeout: const Duration(seconds: 10),
        onConnect: (_) {
          _setStatus(SyncStatus.connected);
          _subscribe();
        },
        onWebSocketDone: () => _setStatus(SyncStatus.connecting),
        onWebSocketError: (Object? error) {
          debugPrint('Saki WebSocket error: $error');
          _setStatus(SyncStatus.connecting);
        },
        onStompError: (frame) {
          debugPrint('Saki STOMP error: ${frame.headers['message']}');
          _setStatus(SyncStatus.connecting);
        },
      ),
    );
  }

  late final StompClient _client;
  final _status = StreamController<SyncStatus>.broadcast();
  final _responses = StreamController<SakiResponse>.broadcast();
  final _events = StreamController<SessionEvent>.broadcast();
  final _audio = StreamController<SakiAudio>.broadcast();
  final List<void Function()> _unsubscribers = [];
  SyncStatus _currentStatus = SyncStatus.disconnected;
  String? _sessionId;
  bool _disposed = false;

  Stream<SyncStatus> get status => _status.stream;
  SyncStatus get currentStatus => _currentStatus;
  Stream<SakiResponse> get responses => _responses.stream;
  Stream<SessionEvent> get events => _events.stream;
  Stream<SakiAudio> get audio => _audio.stream;

  void connect() {
    if (_disposed || _client.isActive) return;
    _setStatus(SyncStatus.connecting);
    _client.activate();
  }

  /// Switches the live subscription to [sessionId] (or none).
  void watchSession(String? sessionId) {
    if (_sessionId == sessionId) return;
    _sessionId = sessionId;
    if (_client.connected) _subscribe();
  }

  void _subscribe() {
    _unsubscribeAll();
    final sessionId = _sessionId;
    if (sessionId == null || !_client.connected) return;
    _unsubscribers
      ..add(_client.subscribe(
        destination: '/topic/session/$sessionId',
        callback: (frame) => _decode(frame.body, SakiResponse.fromJson, _responses),
      ))
      ..add(_client.subscribe(
        destination: '/topic/session/$sessionId/events',
        callback: (frame) => _decode(frame.body, SessionEvent.fromJson, _events),
      ))
      ..add(_client.subscribe(
        destination: '/topic/session/$sessionId/audio',
        callback: (frame) => _decode(frame.body, SakiAudio.fromJson, _audio),
      ));
  }

  void _unsubscribeAll() {
    if (_client.connected) {
      for (final unsubscribe in _unsubscribers) {
        try {
          unsubscribe();
        } catch (_) {
          // Connection dropped between check and call; nothing to undo.
        }
      }
    }
    _unsubscribers.clear();
  }

  void _decode<T>(String? body, T Function(Json) parse, StreamController<T> sink) {
    if (body == null || _disposed) return;
    try {
      sink.add(parse(jsonDecode(body) as Json));
    } catch (error) {
      debugPrint('Ignoring malformed STOMP payload: $error');
    }
  }

  void _setStatus(SyncStatus status) {
    if (_disposed || status == _currentStatus) return;
    _currentStatus = status;
    _status.add(status);
  }

  void dispose() {
    if (_disposed) return;
    _unsubscribeAll();
    _disposed = true;
    _client.deactivate();
    _status.close();
    _responses.close();
    _events.close();
    _audio.close();
  }
}
