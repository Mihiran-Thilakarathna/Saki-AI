export interface EditorLanguage {
  id: string;
  label: string;
  extension: string;
}

/** Monaco language ids offered in the editor toolbar. */
export const EDITOR_LANGUAGES: EditorLanguage[] = [
  { id: 'java', label: 'Java', extension: 'java' },
  { id: 'typescript', label: 'TypeScript', extension: 'ts' },
  { id: 'javascript', label: 'JavaScript', extension: 'js' },
  { id: 'python', label: 'Python', extension: 'py' },
  { id: 'dart', label: 'Dart', extension: 'dart' },
  { id: 'kotlin', label: 'Kotlin', extension: 'kt' },
  { id: 'go', label: 'Go', extension: 'go' },
  { id: 'csharp', label: 'C#', extension: 'cs' },
  { id: 'cpp', label: 'C++', extension: 'cpp' },
  { id: 'c', label: 'C', extension: 'c' },
  { id: 'rust', label: 'Rust', extension: 'rs' },
  { id: 'php', label: 'PHP', extension: 'php' },
  { id: 'ruby', label: 'Ruby', extension: 'rb' },
  { id: 'swift', label: 'Swift', extension: 'swift' },
  { id: 'sql', label: 'SQL', extension: 'sql' },
  { id: 'html', label: 'HTML', extension: 'html' },
  { id: 'css', label: 'CSS', extension: 'css' },
  { id: 'scss', label: 'SCSS', extension: 'scss' },
  { id: 'json', label: 'JSON', extension: 'json' },
  { id: 'yaml', label: 'YAML', extension: 'yaml' },
  { id: 'xml', label: 'XML', extension: 'xml' },
  { id: 'markdown', label: 'Markdown', extension: 'md' },
  { id: 'shell', label: 'Shell', extension: 'sh' },
  { id: 'dockerfile', label: 'Dockerfile', extension: 'Dockerfile' },
  { id: 'plaintext', label: 'Plain Text', extension: 'txt' },
];

const ALIASES: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  typescriptreact: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  javascriptreact: 'javascript',
  node: 'javascript',
  py: 'python',
  kt: 'kotlin',
  kts: 'kotlin',
  'c#': 'csharp',
  cs: 'csharp',
  'c++': 'cpp',
  golang: 'go',
  rs: 'rust',
  rb: 'ruby',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  powershell: 'shell',
  yml: 'yaml',
  md: 'markdown',
  text: 'plaintext',
  txt: 'plaintext',
  postgresql: 'sql',
  mysql: 'sql',
  docker: 'dockerfile',
};

/** Maps whatever language name Saki returned to a Monaco language id. */
export function normalizeLanguage(language: string | null | undefined): string {
  if (!language) return 'plaintext';
  const key = language.trim().toLowerCase();
  const id = ALIASES[key] ?? key;
  return EDITOR_LANGUAGES.some((l) => l.id === id) ? id : 'plaintext';
}

export function defaultFileName(languageId: string): string {
  const language = EDITOR_LANGUAGES.find((l) => l.id === languageId);
  if (!language) return 'snippet.txt';
  if (language.id === 'dockerfile') return 'Dockerfile';
  if (language.id === 'java') return 'Main.java';
  return `main.${language.extension}`;
}

const EXTRA_EXTENSIONS: Record<string, string> = {
  mjs: 'javascript',
  cjs: 'javascript',
  mts: 'typescript',
  cts: 'typescript',
  h: 'cpp',
  hpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  htm: 'html',
  vue: 'html',
  svelte: 'html',
};

/** Monaco language for an imported file, from its name (e.g. "UserService.java" -> java). */
export function languageFromFileName(fileName: string): string {
  const name = fileName.trim();
  if (/^dockerfile/i.test(name)) return 'dockerfile';
  const dot = name.lastIndexOf('.');
  if (dot < 0) return 'plaintext';
  const extension = name.slice(dot + 1).toLowerCase();
  const byExtension = EDITOR_LANGUAGES.find((l) => l.extension.toLowerCase() === extension);
  if (byExtension) return byExtension.id;
  return normalizeLanguage(EXTRA_EXTENSIONS[extension] ?? extension);
}
