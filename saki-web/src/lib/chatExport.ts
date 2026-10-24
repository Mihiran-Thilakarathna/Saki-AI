import { sessionApi } from '@/api/sakiApi';
import type { ConversationMessage, SessionSummary } from '@/types/api';

export type ExportFormat = 'markdown' | 'json';

interface ExportedChat {
  session: SessionSummary;
  messages: ConversationMessage[];
}

const day = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

async function loadChats(sessions: SessionSummary[]): Promise<ExportedChat[]> {
  const chats: ExportedChat[] = [];
  // One chat at a time keeps the load on the free server small.
  for (const session of sessions) {
    chats.push({ session, messages: await sessionApi.messages(session.id) });
  }
  return chats;
}

function toMarkdown(chats: ExportedChat[], exportedAt: Date): string {
  const lines = [`# Saki AI chat history`, '', `Exported ${exportedAt.toLocaleString()}`, ''];
  for (const { session, messages } of chats) {
    lines.push(`## ${session.title}`, '', `_Started ${new Date(session.createdAt).toLocaleString()}_`, '');
    for (const m of messages) {
      const time = new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (m.senderRole === 'USER') {
        lines.push(`**You** (${time}):`, '', m.userTranscript ?? '', '');
        continue;
      }
      lines.push(`**Saki** (${time}):`, '', m.spokenResponse ?? '', '');
      if (m.explanationMarkdown) lines.push(m.explanationMarkdown, '');
      if (m.codeSnippet) {
        if (m.fileName) lines.push(`\`${m.fileName}\``, '');
        lines.push('```' + (m.programmingLanguage ?? ''), m.codeSnippet, '```', '');
      }
    }
    lines.push('---', '');
  }
  return lines.join('\n');
}

/** Downloads the given chats (all of them by default) as a Markdown or JSON file. */
export async function exportChats(sessions: SessionSummary[], format: ExportFormat): Promise<number> {
  const chats = await loadChats(sessions);
  const exportedAt = new Date();
  const [content, type, extension] =
    format === 'json'
      ? [JSON.stringify({ exportedAt: exportedAt.toISOString(), chats }, null, 2), 'application/json', 'json']
      : [toMarkdown(chats, exportedAt), 'text/markdown', 'md'];
  const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `saki-chats-${day(exportedAt)}.${extension}`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return chats.length;
}
