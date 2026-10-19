import 'package:flutter/material.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/models.dart';
import '../../state/core_providers.dart';
import '../theme.dart';
import 'code_card.dart';
import 'saki_logo.dart';

class MessageTile extends ConsumerWidget {
  const MessageTile({super.key, required this.entry});

  final ChatEntry entry;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final time = TimeOfDay.fromDateTime(entry.createdAt).format(context);
    final bodyStyle = const TextStyle(fontSize: 15, color: SakiColors.ink100, height: 1.45).forLanguage(entry.isSinhala);

    if (!entry.fromSaki) {
      return Align(
        alignment: Alignment.centerRight,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.82),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: const BoxDecoration(
                  color: SakiColors.ink700,
                  borderRadius: BorderRadius.only(
                    topLeft: Radius.circular(18),
                    topRight: Radius.circular(18),
                    bottomLeft: Radius.circular(18),
                    bottomRight: Radius.circular(6),
                  ),
                ),
                child: Text(entry.text.isEmpty ? '(no speech detected)' : entry.text, style: bodyStyle),
              ),
              const SizedBox(height: 4),
              Text(
                '${entry.fromOtherDevice ? 'from Web IDE · ' : ''}$time',
                style: const TextStyle(fontSize: 11, color: SakiColors.ink400),
              ),
            ],
          ),
        ),
      );
    }

    final player = ref.watch(audioPlayerProvider);
    final speaking = ref.watch(speakingProvider).value ?? false;
    final speakingThis = speaking && player.lastMessageId == entry.id;
    final canReplay = player.hasClip(entry.id);
    final explanation = entry.code.explanationMarkdown;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SakiLogo(size: 30, animated: speakingThis),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 250),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: speakingThis ? SakiColors.saki500.withValues(alpha: 0.07) : SakiColors.ink850,
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(6),
                    topRight: Radius.circular(18),
                    bottomLeft: Radius.circular(18),
                    bottomRight: Radius.circular(18),
                  ),
                  border: Border.all(color: speakingThis ? SakiColors.saki500 : SakiColors.ink700),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(entry.text, style: bodyStyle),
                    if (explanation != null && explanation.isNotEmpty) ...[
                      const Divider(height: 20),
                      MarkdownBody(
                        data: explanation,
                        styleSheet: _markdownStyle(entry.isSinhala),
                      ),
                    ],
                    if (entry.code.hasRenderableCode) CodeCard(code: entry.code),
                  ],
                ),
              ),
              const SizedBox(height: 4),
              Row(
                children: [
                  Text(
                    'Saki · $time${entry.fromOtherDevice ? ' · Web IDE' : ''}',
                    style: const TextStyle(fontSize: 11, color: SakiColors.ink400),
                  ),
                  if (canReplay) ...[
                    const SizedBox(width: 8),
                    InkWell(
                      onTap: () => speakingThis ? player.stop() : player.play(entry.id),
                      child: Padding(
                        padding: const EdgeInsets.all(4),
                        child: Row(
                          children: [
                            Icon(
                              speakingThis ? Icons.stop_rounded : Icons.play_arrow_rounded,
                              size: 14,
                              color: SakiColors.saki300,
                            ),
                            Text(
                              speakingThis ? ' Stop' : ' Replay',
                              style: const TextStyle(fontSize: 11, color: SakiColors.saki300),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  static MarkdownStyleSheet _markdownStyle(bool sinhala) {
    final text = const TextStyle(fontSize: 13.5, color: SakiColors.ink200, height: 1.5).forLanguage(sinhala);
    return MarkdownStyleSheet(
      p: text,
      listBullet: text,
      strong: text.copyWith(fontWeight: FontWeight.w600, color: SakiColors.ink100),
      code: SakiTheme.mono(size: 12, color: SakiColors.saki300).copyWith(backgroundColor: SakiColors.ink700),
      codeblockDecoration: BoxDecoration(color: SakiColors.ink950, borderRadius: BorderRadius.circular(8)),
      a: const TextStyle(color: SakiColors.saki400),
    );
  }
}
