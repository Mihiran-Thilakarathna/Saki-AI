import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_highlight/flutter_highlight.dart';

import '../../core/languages.dart';
import '../../models/models.dart';
import '../theme.dart';
import '../widgets/code_card.dart';

/// Full-screen, pinch-free code reader with adjustable font size and copy.
class CodeViewerScreen extends StatefulWidget {
  const CodeViewerScreen({super.key, required this.code});

  final CodePayload code;

  static Future<void> open(BuildContext context, CodePayload code) =>
      Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => CodeViewerScreen(code: code)));

  @override
  State<CodeViewerScreen> createState() => _CodeViewerScreenState();
}

class _CodeViewerScreenState extends State<CodeViewerScreen> {
  double _fontSize = 13;

  @override
  Widget build(BuildContext context) {
    final code = widget.code;
    return Scaffold(
      backgroundColor: SakiColors.ink950,
      appBar: AppBar(
        title: Text(code.fileName ?? 'Code', style: SakiTheme.mono(size: 15)),
        actions: [
          IconButton(
            tooltip: 'Smaller text',
            icon: const Icon(Icons.text_decrease_rounded),
            onPressed: _fontSize > 9 ? () => setState(() => _fontSize -= 1) : null,
          ),
          IconButton(
            tooltip: 'Larger text',
            icon: const Icon(Icons.text_increase_rounded),
            onPressed: _fontSize < 22 ? () => setState(() => _fontSize += 1) : null,
          ),
          IconButton(
            tooltip: 'Copy code',
            icon: const Icon(Icons.copy_rounded),
            onPressed: () async {
              await Clipboard.setData(ClipboardData(text: code.code ?? ''));
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Code copied')));
              }
            },
          ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: HighlightView(
              code.code ?? '',
              language: highlightLanguage(code.programmingLanguage),
              theme: CodeCard.theme,
              padding: const EdgeInsets.all(16),
              textStyle: SakiTheme.mono(size: _fontSize),
              tabSize: 4,
            ),
          ),
        ),
      ),
    );
  }
}
