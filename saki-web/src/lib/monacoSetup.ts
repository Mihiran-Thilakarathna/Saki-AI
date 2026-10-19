import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

// Bundle Monaco locally (instead of the default CDN loader) so the IDE works offline
// and behind strict CSPs.
self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    switch (label) {
      case 'json':
        return new jsonWorker();
      case 'css':
      case 'scss':
      case 'less':
        return new cssWorker();
      case 'html':
      case 'handlebars':
      case 'razor':
        return new htmlWorker();
      case 'typescript':
      case 'javascript':
        return new tsWorker();
      default:
        return new editorWorker();
    }
  },
};

loader.config({ monaco });

export const SAKI_DARK_THEME = 'saki-dark';
export const SAKI_LIGHT_THEME = 'saki-light';

monaco.editor.defineTheme(SAKI_DARK_THEME, {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '6b7a90', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'a78bfa' },
    { token: 'string', foreground: '5eead4' },
    { token: 'number', foreground: 'fbbf24' },
    { token: 'type', foreground: '7dd3fc' },
    { token: 'annotation', foreground: 'f472b6' },
  ],
  colors: {
    'editor.background': '#0b0f17',
    'editor.lineHighlightBackground': '#131a26',
    'editorLineNumber.foreground': '#2a3548',
    'editorLineNumber.activeForeground': '#8b98a9',
    'editor.selectionBackground': '#2dd4bf33',
    'editorCursor.foreground': '#2dd4bf',
    'editorIndentGuide.background1': '#1f293b',
    'editorWidget.background': '#0f141e',
    'editorWidget.border': '#1f293b',
    'minimap.background': '#0b0f17',
    'scrollbarSlider.background': '#2a354866',
  },
});

monaco.editor.defineTheme(SAKI_LIGHT_THEME, {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '66758b', fontStyle: 'italic' },
    { token: 'keyword', foreground: '7c3aed' },
    { token: 'string', foreground: '0f766e' },
    { token: 'number', foreground: 'b45309' },
    { token: 'type', foreground: '0369a1' },
    { token: 'annotation', foreground: 'be185d' },
  ],
  colors: {
    'editor.background': '#ffffff',
    'editor.lineHighlightBackground': '#f6f8fa',
    'editorLineNumber.foreground': '#b8c2d0',
    'editorLineNumber.activeForeground': '#2b3645',
    'editor.selectionBackground': '#14b8a630',
    'editorCursor.foreground': '#0d9488',
    'editorIndentGuide.background1': '#e6eaf0',
    'editorWidget.background': '#ffffff',
    'editorWidget.border': '#d8dee7',
    'minimap.background': '#ffffff',
  },
});
