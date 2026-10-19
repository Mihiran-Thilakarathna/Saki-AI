const Map<String, String> _aliases = {
  'ts': 'typescript',
  'tsx': 'typescript',
  'typescriptreact': 'typescript',
  'js': 'javascript',
  'jsx': 'javascript',
  'javascriptreact': 'javascript',
  'py': 'python',
  'kt': 'kotlin',
  'csharp': 'cs',
  'c#': 'cs',
  'c++': 'cpp',
  'c': 'cpp',
  'golang': 'go',
  'rs': 'rust',
  'rb': 'ruby',
  'html': 'xml',
  'shell': 'bash',
  'sh': 'bash',
  'zsh': 'bash',
  'yml': 'yaml',
  'md': 'markdown',
  'text': 'plaintext',
  'txt': 'plaintext',
  'postgresql': 'pgsql',
  'mysql': 'sql',
  'docker': 'dockerfile',
};

const Set<String> _supported = {
  'java', 'typescript', 'javascript', 'python', 'dart', 'kotlin', 'go', 'cs', 'cpp', 'rust', 'php', 'ruby', //
  'swift', 'sql', 'pgsql', 'xml', 'css', 'scss', 'json', 'yaml', 'markdown', 'bash', 'dockerfile', 'plaintext',
  'gradle', 'groovy', 'scala', 'powershell', 'properties', 'ini', 'makefile',
};

/// Maps the Monaco-style language id Saki returns to a `highlight` package id.
String highlightLanguage(String? language) {
  if (language == null || language.trim().isEmpty) return 'plaintext';
  final key = language.trim().toLowerCase();
  final id = _aliases[key] ?? key;
  return _supported.contains(id) ? id : 'plaintext';
}
