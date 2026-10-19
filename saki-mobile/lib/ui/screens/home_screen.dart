import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/models.dart';
import '../../services/stomp_sync.dart';
import '../../state/conversation.dart';
import '../../state/core_providers.dart';
import '../../state/sessions.dart';
import '../../state/settings.dart';
import '../../state/voice.dart';
import '../theme.dart';
import '../widgets/code_card.dart';
import '../widgets/message_tile.dart';
import '../widgets/mic_button.dart';
import '../widgets/saki_logo.dart';
import 'session_picker.dart';
import 'settings_sheet.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(selectedSessionProvider);
    final settings = ref.watch(settingsProvider);
    final sync = ref.watch(syncStatusProvider).value ?? SyncStatus.disconnected;

    void showNotice(String? message) {
      if (message == null) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(message)));
    }

    ref.listen(conversationProvider.select((c) => c.noticeSeq), (_, _) {
      showNotice(ref.read(conversationProvider).notice);
    });
    ref.listen(voiceControllerProvider.select((v) => v.noticeSeq), (_, _) {
      showNotice(ref.read(voiceControllerProvider).notice);
    });

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 12,
        title: InkWell(
          borderRadius: BorderRadius.circular(8),
          onTap: () => SessionPicker.show(context),
          child: Row(
            children: [
              const SakiLogo(size: 30),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            session?.title ?? 'Saki AI',
                            overflow: TextOverflow.ellipsis,
                            style: SakiTheme.sinhala(const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                          ),
                        ),
                        const Icon(Icons.arrow_drop_down_rounded, color: SakiColors.ink300),
                      ],
                    ),
                    _SyncLabel(status: sync, companion: settings.isCompanion),
                  ],
                ),
              ),
            ],
          ),
        ),
        actions: [
          IconButton(
            tooltip: settings.muted ? 'Unmute Saki' : 'Mute Saki',
            icon: Icon(
              settings.muted ? Icons.volume_off_rounded : Icons.volume_up_rounded,
              color: settings.muted ? SakiColors.recording : null,
            ),
            onPressed: () async {
              await ref.read(settingsProvider.notifier).toggleMuted();
              await ref.read(audioPlayerProvider).stop();
            },
          ),
          IconButton(
            tooltip: 'Settings',
            icon: const Icon(Icons.tune_rounded),
            onPressed: () => SettingsSheet.show(context),
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(52),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
            child: SizedBox(
              width: double.infinity,
              child: SegmentedButton<SakiMode>(
                segments: const [
                  ButtonSegment(
                    value: SakiMode.standalone,
                    icon: Icon(Icons.phone_android_rounded, size: 18),
                    label: Text('Standalone'),
                  ),
                  ButtonSegment(
                    value: SakiMode.companion,
                    icon: Icon(Icons.laptop_chromebook_rounded, size: 18),
                    label: Text('Web IDE mic'),
                  ),
                ],
                selected: {settings.mode},
                showSelectedIcon: false,
                onSelectionChanged: (s) => ref.read(settingsProvider.notifier).setMode(s.first),
              ),
            ),
          ),
        ),
      ),
      body: session == null
          ? const _NoSessionView()
          : settings.isCompanion
              ? const _CompanionView()
              : const _StandaloneView(),
    );
  }
}

class _SyncLabel extends StatelessWidget {
  const _SyncLabel({required this.status, required this.companion});

  final SyncStatus status;
  final bool companion;

  @override
  Widget build(BuildContext context) {
    final (color, text) = switch (status) {
      SyncStatus.connected => (SakiColors.success, companion ? 'Paired · live with Web IDE' : 'Live sync on'),
      SyncStatus.connecting => (SakiColors.warning, 'Connecting…'),
      SyncStatus.disconnected => (SakiColors.ink400, 'Offline'),
    };
    return Row(
      children: [
        Container(width: 7, height: 7, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 6),
        Text(text, style: const TextStyle(fontSize: 11.5, color: SakiColors.ink300)),
      ],
    );
  }
}

class _NoSessionView extends ConsumerWidget {
  const _NoSessionView();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sessions = ref.watch(sessionsProvider);
    // Auto-select the most recent session the first time sessions load.
    ref.listen(sessionsProvider, (_, next) {
      final items = next.value;
      if (items != null && items.isNotEmpty && ref.read(settingsProvider).lastSessionId == null) {
        ref.read(settingsProvider.notifier).selectSession(items.first.id);
      }
    });
    if (sessions.isLoading) return const Center(child: CircularProgressIndicator());
    return const SessionPicker();
  }
}

// ------------------------------------------------------------------ standalone

class _StandaloneView extends ConsumerStatefulWidget {
  const _StandaloneView();

  @override
  ConsumerState<_StandaloneView> createState() => _StandaloneViewState();
}

class _StandaloneViewState extends ConsumerState<_StandaloneView> {
  final _scroll = ScrollController();
  final _text = TextEditingController();

  @override
  void dispose() {
    _scroll.dispose();
    _text.dispose();
    super.dispose();
  }

  void _scrollToEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.animateTo(
          _scroll.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _sendText() async {
    final query = _text.text.trim();
    if (query.isEmpty) return;
    _text.clear();
    FocusScope.of(context).unfocus();
    final ok = await ref.read(conversationProvider.notifier).sendText(query);
    if (!ok && mounted && _text.text.isEmpty) _text.text = query;
  }

  @override
  Widget build(BuildContext context) {
    final conversation = ref.watch(conversationProvider);
    ref.listen(conversationProvider.select((c) => (c.messages.length, c.thinking, c.remoteActivity)), (_, _) {
      _scrollToEnd();
    });

    return Column(
      children: [
        Expanded(
          child: conversation.loading
              ? const Center(child: CircularProgressIndicator())
              : conversation.messages.isEmpty && !conversation.thinking
                  ? _EmptyConversation(onSuggestion: (text) => ref.read(conversationProvider.notifier).sendText(text))
                  : ListView.separated(
                      controller: _scroll,
                      padding: const EdgeInsets.fromLTRB(14, 16, 14, 16),
                      itemCount: conversation.messages.length + 1,
                      separatorBuilder: (_, _) => const SizedBox(height: 16),
                      itemBuilder: (context, index) {
                        if (index == conversation.messages.length) {
                          return _ThinkingRow(
                            visible: conversation.thinking || conversation.remoteActivity,
                            remote: conversation.remoteActivity && !conversation.thinking,
                          );
                        }
                        return MessageTile(entry: conversation.messages[index]);
                      },
                    ),
        ),
        _VoiceDock(textController: _text, onSendText: _sendText),
      ],
    );
  }
}

class _EmptyConversation extends StatelessWidget {
  const _EmptyConversation({required this.onSuggestion});

  final ValueChanged<String> onSuggestion;

  static const _suggestions = [
    'Implement JWT authentication in a Spring Boot REST API',
    'Flutter වල StatefulWidget සහ StatelessWidget අතර වෙනස පැහැදිලි කරන්න',
    'Explain async and await in Dart with an example',
  ];

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        const SizedBox(height: 12),
        const Center(child: SakiLogo(size: 64, animated: true)),
        const SizedBox(height: 16),
        const Text(
          'How can I help with your code?',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 6),
        const Text(
          'Ask by voice or text in Sinhala or English. Tap the mic, hold to talk, or say "Hey Saki".',
          textAlign: TextAlign.center,
          style: TextStyle(color: SakiColors.ink300),
        ),
        const SizedBox(height: 24),
        const Text(
          'TRY ASKING',
          style: TextStyle(color: SakiColors.ink400, fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 0.8),
        ),
        const SizedBox(height: 8),
        for (final suggestion in _suggestions)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: OutlinedButton(
              style: OutlinedButton.styleFrom(
                alignment: Alignment.centerLeft,
                padding: const EdgeInsets.all(14),
                side: const BorderSide(color: SakiColors.ink700),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                foregroundColor: SakiColors.ink200,
              ),
              onPressed: () => onSuggestion(suggestion),
              child: Text(suggestion, style: SakiTheme.sinhala(const TextStyle(fontSize: 14))),
            ),
          ),
      ],
    );
  }
}

class _ThinkingRow extends StatelessWidget {
  const _ThinkingRow({required this.visible, required this.remote});

  final bool visible;
  final bool remote;

  @override
  Widget build(BuildContext context) {
    if (!visible) return const SizedBox.shrink();
    return Row(
      children: [
        const SakiLogo(size: 30, animated: true),
        const SizedBox(width: 10),
        Flexible(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: SakiColors.ink850,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: SakiColors.ink700),
            ),
            child: Text(
              remote ? 'Your Web IDE asked Saki — thinking…' : 'Saki is thinking…',
              style: const TextStyle(color: SakiColors.ink300),
            ),
          ),
        ),
      ],
    );
  }
}

class _VoiceDock extends ConsumerWidget {
  const _VoiceDock({required this.textController, required this.onSendText});

  final TextEditingController textController;
  final VoidCallback onSendText;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final voice = ref.watch(voiceControllerProvider);
    final thinking = ref.watch(conversationProvider.select((c) => c.thinking));
    final speaking = ref.watch(speakingProvider).value ?? false;
    final wakeEnabled = ref.watch(settingsProvider.select((s) => s.wakeWordEnabled));
    final controller = ref.read(voiceControllerProvider.notifier);

    return Container(
      decoration: const BoxDecoration(
        color: SakiColors.ink850,
        border: Border(top: BorderSide(color: SakiColors.ink700)),
      ),
      padding: const EdgeInsets.fromLTRB(8, 4, 12, 8),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                MicButton(
                  size: 60,
                  recording: voice.recording,
                  busy: thinking,
                  wakeListening: voice.wakeListening,
                  levels: controller.levels,
                  onTap: controller.toggle,
                  onHoldStart: controller.start,
                  onHoldEnd: controller.stopAndSend,
                ),
                Expanded(
                  child: Text(
                    _statusText(voice, thinking: thinking, speaking: speaking),
                    style: const TextStyle(fontSize: 13, color: SakiColors.ink300),
                  ),
                ),
                if (voice.recording)
                  IconButton(
                    tooltip: 'Cancel',
                    icon: const Icon(Icons.close_rounded),
                    onPressed: controller.cancel,
                  )
                else if (speaking)
                  IconButton(
                    tooltip: 'Stop Saki',
                    icon: const Icon(Icons.stop_circle_outlined),
                    onPressed: () => ref.read(audioPlayerProvider).stop(),
                  ),
                _WakeChip(enabled: wakeEnabled, onTap: controller.toggleWakeWord),
              ],
            ),
            Row(
              children: [
                const SizedBox(width: 6),
                Expanded(
                  child: TextField(
                    controller: textController,
                    minLines: 1,
                    maxLines: 4,
                    maxLength: 4000,
                    textInputAction: TextInputAction.send,
                    onSubmitted: (_) => onSendText(),
                    style: SakiTheme.sinhala(const TextStyle(fontSize: 14)),
                    decoration: const InputDecoration(
                      hintText: 'Type to Saki in සිංහල or English…',
                      counterText: '',
                      isDense: true,
                    ),
                  ),
                ),
                const SizedBox(width: 6),
                IconButton.filledTonal(
                  tooltip: 'Send',
                  onPressed: thinking ? null : onSendText,
                  icon: const Icon(Icons.send_rounded),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

String _statusText(VoiceState voice, {required bool thinking, required bool speaking}) {
  if (voice.recording) {
    return voice.handsFree ? 'Listening… I\'ll send when you pause' : 'Recording… tap (or release) to send';
  }
  if (thinking) return 'Saki is thinking…';
  if (speaking) return 'Saki is speaking — tap the mic to interrupt';
  if (voice.wakeListening) return 'Say "Hey Saki" or tap the mic';
  return 'Tap or hold the mic to talk';
}

class _WakeChip extends StatelessWidget {
  const _WakeChip({required this.enabled, required this.onTap});

  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return FilterChip(
      selected: enabled,
      showCheckmark: false,
      avatar: Icon(enabled ? Icons.hearing_rounded : Icons.hearing_disabled_rounded, size: 16),
      label: const Text('Hey Saki', style: TextStyle(fontSize: 12)),
      selectedColor: SakiColors.saki500.withValues(alpha: 0.18),
      side: BorderSide(color: enabled ? SakiColors.saki500 : SakiColors.ink700),
      onSelected: (_) => onTap(),
      visualDensity: VisualDensity.compact,
    );
  }
}

// ------------------------------------------------------------------ companion (wireless Web IDE mic)

class _CompanionView extends ConsumerWidget {
  const _CompanionView();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(selectedSessionProvider)!;
    final voice = ref.watch(voiceControllerProvider);
    final conversation = ref.watch(conversationProvider);
    final speaking = ref.watch(speakingProvider).value ?? false;
    final sync = ref.watch(syncStatusProvider).value ?? SyncStatus.disconnected;
    final wakeEnabled = ref.watch(settingsProvider.select((s) => s.wakeWordEnabled));
    final controller = ref.read(voiceControllerProvider.notifier);
    final delivery = conversation.lastDelivery;

    return LayoutBuilder(
      builder: (context, constraints) => SingleChildScrollView(
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: constraints.maxHeight),
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _PairingCard(title: session.title, status: sync, remoteActivity: conversation.remoteActivity),
                const SizedBox(height: 24),
                Column(
                  children: [
                    MicButton(
                      size: 132,
                      recording: voice.recording,
                      busy: conversation.thinking,
                      wakeListening: voice.wakeListening,
                      levels: controller.levels,
                      onTap: controller.toggle,
                      onHoldStart: controller.start,
                      onHoldEnd: controller.stopAndSend,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      conversation.thinking
                          ? 'Saki is writing code on your laptop…'
                          : _statusText(voice, thinking: false, speaking: speaking),
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 15, color: SakiColors.ink200),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        _WakeChip(enabled: wakeEnabled, onTap: controller.toggleWakeWord),
                        if (voice.recording) ...[
                          const SizedBox(width: 8),
                          ActionChip(
                            avatar: const Icon(Icons.close_rounded, size: 16),
                            label: const Text('Cancel'),
                            onPressed: controller.cancel,
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                if (delivery != null) _DeliveryCard(transcript: delivery.userTranscript, code: delivery.codePayload),
                if (delivery == null)
                  const Text(
                    'Speak your question in සිංහල or English. The code appears in the Web IDE editor '
                    'and Saki answers from your laptop speakers.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: SakiColors.ink400, fontSize: 13),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _PairingCard extends StatelessWidget {
  const _PairingCard({required this.title, required this.status, required this.remoteActivity});

  final String title;
  final SyncStatus status;
  final bool remoteActivity;

  @override
  Widget build(BuildContext context) {
    final live = status == SyncStatus.connected;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: SakiColors.ink850,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: live ? SakiColors.saki500.withValues(alpha: 0.5) : SakiColors.ink700),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: (live ? SakiColors.saki500 : SakiColors.ink600).withValues(alpha: 0.18),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(Icons.laptop_chromebook_rounded, color: live ? SakiColors.saki300 : SakiColors.ink400),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  live ? 'Paired with Web IDE session' : 'Connecting to Web IDE…',
                  style: const TextStyle(fontSize: 12, color: SakiColors.ink300),
                ),
                const SizedBox(height: 2),
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: SakiTheme.sinhala(const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                ),
                if (remoteActivity)
                  const Padding(
                    padding: EdgeInsets.only(top: 4),
                    child: Text('Laptop is asking Saki…', style: TextStyle(fontSize: 12, color: SakiColors.iris400)),
                  ),
              ],
            ),
          ),
          TextButton(onPressed: () => SessionPicker.show(context), child: const Text('Change')),
        ],
      ),
    );
  }
}

class _DeliveryCard extends StatelessWidget {
  const _DeliveryCard({required this.transcript, required this.code});

  final String transcript;
  final CodePayload code;

  @override
  Widget build(BuildContext context) {
    final sinhala = RegExp(r'[඀-෿]').hasMatch(transcript);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: SakiColors.ink850,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: SakiColors.ink700),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.check_circle_rounded, size: 18, color: SakiColors.success),
              SizedBox(width: 6),
              Text('Delivered to your Web IDE', style: TextStyle(fontWeight: FontWeight.w600)),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            '"$transcript"',
            style: const TextStyle(color: SakiColors.ink200, fontStyle: FontStyle.italic).forLanguage(sinhala),
          ),
          if (code.hasRenderableCode) CodeCard(code: code, previewLines: 6),
        ],
      ),
    );
  }
}
