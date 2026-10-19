import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_highlight/flutter_highlight.dart';
import 'package:flutter_highlight/themes/atom-one-dark.dart';

import '../../core/languages.dart';
import '../../models/models.dart';
import '../screens/code_viewer_screen.dart';
import '../theme.dart';

/// Syntax-highlighted code from Saki. Shows a preview; tap for the full-screen viewer.
class CodeCard extends StatelessWidget {
  const CodeCard({super.key, required this.code, this.previewLines = 14});

  final CodePayload code;
  final int previewLines;

  @override
  Widget build(BuildContext context) {
    final source = code.code ?? '';
    final lines = source.split('\n');
    final truncated = lines.length > previewLines;
    final preview = truncated ? lines.take(previewLines).join('\n') : source;

    return Container(
      margin: const EdgeInsets.only(top: 10),
      decoration: BoxDecoration(
        color: SakiColors.ink950,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: SakiColors.ink700),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          CodeHeader(code: code, lineCount: lines.length),
          InkWell(
            onTap: () => CodeViewerScreen.open(context, code),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: HighlightView(
                preview,
                language: highlightLanguage(code.programmingLanguage),
                theme: _theme,
                padding: const EdgeInsets.all(12),
                textStyle: SakiTheme.mono(size: 12.5),
                tabSize: 4,
              ),
            ),
          ),
          if (truncated)
            TextButton.icon(
              onPressed: () => CodeViewerScreen.open(context, code),
              icon: const Icon(Icons.open_in_full_rounded, size: 16),
              label: Text('View all ${lines.length} lines'),
            ),
        ],
      ),
    );
  }

  static final Map<String, TextStyle> _theme = {
    ...atomOneDarkTheme,
    'root': (atomOneDarkTheme['root'] ?? const TextStyle()).copyWith(backgroundColor: SakiColors.ink950),
  };

  static Map<String, TextStyle> get theme => _theme;
}

class CodeHeader extends StatelessWidget {
  const CodeHeader({super.key, required this.code, required this.lineCount});

  final CodePayload code;
  final int lineCount;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: SakiColors.ink850,
      padding: const EdgeInsets.fromLTRB(12, 6, 4, 6),
      child: Row(
        children: [
          const Icon(Icons.description_outlined, size: 16, color: SakiColors.saki400),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              code.fileName ?? 'snippet',
              overflow: TextOverflow.ellipsis,
              style: SakiTheme.mono(size: 12.5),
            ),
          ),
          Text(
            '${code.programmingLanguage ?? 'text'} · $lineCount lines',
            style: const TextStyle(fontSize: 11, color: SakiColors.ink400),
          ),
          IconButton(
            tooltip: 'Copy code',
            visualDensity: VisualDensity.compact,
            icon: const Icon(Icons.copy_rounded, size: 16, color: SakiColors.ink300),
            onPressed: () async {
              await Clipboard.setData(ClipboardData(text: code.code ?? ''));
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Code copied')));
              }
            },
          ),
        ],
      ),
    );
  }
}
