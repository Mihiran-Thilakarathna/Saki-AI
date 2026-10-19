import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api_client.dart';
import '../../models/models.dart';
import '../../state/sessions.dart';
import '../../state/settings.dart';
import '../theme.dart';

/// Session selector. In companion mode this is how the phone pairs with the
/// session that is open in the Web IDE (same account, same session id).
class SessionPicker extends ConsumerWidget {
  const SessionPicker({super.key, this.inSheet = false});

  final bool inSheet;

  static Future<void> show(BuildContext context) => showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        builder: (_) => DraggableScrollableSheet(
          expand: false,
          initialChildSize: 0.6,
          maxChildSize: 0.92,
          builder: (context, controller) => PrimaryScrollController(
            controller: controller,
            child: const SessionPicker(inSheet: true),
          ),
        ),
      );

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sessions = ref.watch(sessionsProvider);
    final selectedId = ref.watch(settingsProvider.select((s) => s.lastSessionId));
    final companion = ref.watch(settingsProvider.select((s) => s.isCompanion));

    Future<void> select(SessionSummary session) async {
      await ref.read(settingsProvider.notifier).selectSession(session.id);
      if (inSheet && context.mounted) Navigator.of(context).pop();
    }

    Future<void> create() async {
      try {
        await ref.read(sessionsProvider.notifier).create();
        if (inSheet && context.mounted) Navigator.of(context).pop();
      } on ApiException catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.displayMessage)));
        }
      }
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 12, 4),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  companion ? 'Pair with a Web IDE session' : 'Your coding sessions',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
                ),
              ),
              IconButton(
                tooltip: 'Refresh',
                icon: const Icon(Icons.refresh_rounded),
                onPressed: () => ref.read(sessionsProvider.notifier).refresh(),
              ),
            ],
          ),
        ),
        if (companion)
          const Padding(
            padding: EdgeInsets.fromLTRB(20, 0, 20, 8),
            child: Text(
              'Pick the session that is open on your laptop. The most recently active one is at the top.',
              style: TextStyle(color: SakiColors.ink300, fontSize: 13),
            ),
          ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          child: OutlinedButton.icon(
            onPressed: create,
            icon: const Icon(Icons.add_rounded),
            label: const Text('New session'),
            style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(44),
              side: const BorderSide(color: SakiColors.ink600),
            ),
          ),
        ),
        Expanded(
          child: sessions.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  e is ApiException ? e.displayMessage : 'Could not load sessions',
                  textAlign: TextAlign.center,
                ),
              ),
            ),
            data: (items) => items.isEmpty
                ? const Center(child: Text('No sessions yet', style: TextStyle(color: SakiColors.ink300)))
                : ListView.builder(
                    primary: inSheet,
                    padding: const EdgeInsets.fromLTRB(8, 4, 8, 24),
                    itemCount: items.length,
                    itemBuilder: (context, index) {
                      final session = items[index];
                      final selected = session.id == selectedId;
                      return ListTile(
                        selected: selected,
                        selectedTileColor: SakiColors.saki500.withValues(alpha: 0.1),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        leading: Icon(
                          companion && index == 0 ? Icons.laptop_chromebook_rounded : Icons.forum_outlined,
                          color: selected ? SakiColors.saki400 : SakiColors.ink400,
                        ),
                        title: Text(
                          session.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: SakiTheme.sinhala(const TextStyle(fontSize: 15)),
                        ),
                        subtitle: Text(
                          [
                            if (session.activeLanguage != null) session.activeLanguage!,
                            _relative(session.updatedAt),
                            if (companion && index == 0) 'most recent',
                          ].join(' · '),
                          style: const TextStyle(fontSize: 12, color: SakiColors.ink400),
                        ),
                        trailing: selected ? const Icon(Icons.check_circle, color: SakiColors.saki400) : null,
                        onTap: () => select(session),
                      );
                    },
                  ),
          ),
        ),
      ],
    );
  }

  static String _relative(DateTime time) {
    final diff = DateTime.now().difference(time);
    if (diff.inMinutes < 1) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes} min ago';
    if (diff.inHours < 24) return '${diff.inHours} h ago';
    return '${diff.inDays} d ago';
  }
}
