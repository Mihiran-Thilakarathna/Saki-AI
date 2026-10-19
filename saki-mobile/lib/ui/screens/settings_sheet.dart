import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/core_providers.dart';
import '../../state/settings.dart';
import '../../state/voice.dart';
import '../theme.dart';

class SettingsSheet extends ConsumerWidget {
  const SettingsSheet({super.key});

  static Future<void> show(BuildContext context) => showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        builder: (_) => const SettingsSheet(),
      );

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settings = ref.watch(settingsProvider);
    final user = ref.watch(authProvider).value?.user;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(8, 0, 8, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (user != null)
              ListTile(
                leading: CircleAvatar(
                  backgroundColor: SakiColors.ink700,
                  child: Text(user.fullName.isEmpty ? '?' : user.fullName[0].toUpperCase()),
                ),
                title: Text(user.fullName),
                subtitle: Text(user.email, style: const TextStyle(color: SakiColors.ink400)),
              ),
            const Divider(),
            SwitchListTile(
              secondary: const Icon(Icons.hearing_rounded),
              title: const Text('"Hey Saki" hands-free'),
              subtitle: const Text('Listen for the wake phrase while the app is open'),
              value: settings.wakeWordEnabled,
              onChanged: (_) => ref.read(voiceControllerProvider.notifier).toggleWakeWord(),
            ),
            SwitchListTile(
              secondary: const Icon(Icons.volume_off_rounded),
              title: const Text('Mute Saki on this phone'),
              value: settings.muted,
              onChanged: (_) async {
                await ref.read(settingsProvider.notifier).toggleMuted();
                await ref.read(audioPlayerProvider).stop();
              },
            ),
            SwitchListTile(
              secondary: const Icon(Icons.speaker_phone_rounded),
              title: const Text('Speak answers on phone in companion mode'),
              subtitle: const Text('Off: only the laptop speaks'),
              value: settings.playAudioInCompanion,
              onChanged: (v) => ref.read(settingsProvider.notifier).setPlayAudioInCompanion(v),
            ),
            ListTile(
              leading: const Icon(Icons.dns_outlined),
              title: const Text('Backend server'),
              subtitle: Text(settings.serverUrl, style: SakiTheme.mono(size: 12, color: SakiColors.ink300)),
            ),
            ListTile(
              leading: const Icon(Icons.logout_rounded, color: SakiColors.recording),
              title: const Text('Sign out', style: TextStyle(color: SakiColors.recording)),
              onTap: () async {
                Navigator.of(context).pop();
                await ref.read(audioPlayerProvider).stop();
                await ref.read(authProvider.notifier).logout();
              },
            ),
          ],
        ),
      ),
    );
  }
}
