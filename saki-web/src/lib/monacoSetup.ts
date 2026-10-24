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

const colorProbe = document.createElement('canvas').getContext('2d');

/**
 * Reads a theme color from the CSS variables in index.css as #rrggbb. Monaco only accepts
 * that form, while the minified CSS may shorten it (e.g. #ffffff -> #fff).
 */
function cssColor(name: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
  if (!colorProbe) return value;
  colorProbe.fillStyle = '#000000';
  colorProbe.fillStyle = value;
  return colorProbe.fillStyle;
}

/**
 * Defines (or refreshes) the editor theme for the current light/dark mode and chat theme,
 * built from the same CSS variables as the rest of the page, and returns its name.
 * Call it after <html data-theme / data-palette> have changed.
 */
export function sakiEditorTheme(mode: 'dark' | 'light', palette: string): string {
  const name = `saki-${mode}-${palette}`;
  const hex = (variable: string) => cssColor(variable).replace('#', '');
  const dark = mode === 'dark';
  monaco.editor.defineTheme(name, {
    base: dark ? 'vs-dark' : 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: hex('ink-400'), fontStyle: 'italic' },
      { token: 'keyword', foreground: hex('iris-400') },
      { token: 'string', foreground: hex('saki-300') },
      { token: 'number', foreground: dark ? 'fbbf24' : 'b45309' },
      { token: 'type', foreground: hex('saki-300') },
      { token: 'annotation', foreground: dark ? 'f472b6' : 'be185d' },
    ],
    colors: {
      'editor.background': cssColor(dark ? 'ink-900' : 'ink-850'),
      'editor.lineHighlightBackground': cssColor(dark ? 'ink-800' : 'ink-900'),
      'editorLineNumber.foreground': cssColor('ink-600'),
      'editorLineNumber.activeForeground': cssColor(dark ? 'ink-300' : 'ink-200'),
      'editor.selectionBackground': `${cssColor(dark ? 'saki-400' : 'saki-500')}33`,
      'editorCursor.foreground': cssColor(dark ? 'saki-400' : 'saki-600'),
      'editorIndentGuide.background1': cssColor(dark ? 'ink-700' : 'ink-750'),
      'editorWidget.background': cssColor('ink-850'),
      'editorWidget.border': cssColor('ink-700'),
      'minimap.background': cssColor(dark ? 'ink-900' : 'ink-850'),
      'scrollbarSlider.background': `${cssColor('ink-600')}66`,
    },
  });
  return name;
}
