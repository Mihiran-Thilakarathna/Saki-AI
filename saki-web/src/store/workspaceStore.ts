import { create } from 'zustand';
import { assistantApi, sessionApi } from '@/api/sakiApi';
import { EDITOR_SAVE_DEBOUNCE_MS } from '@/config';
import { errorMessage } from '@/lib/apiClient';
import { CLIENT_ID } from '@/lib/clientId';
import { defaultFileName, languageFromFileName, normalizeLanguage } from '@/lib/languages';
import { useAudioStore } from '@/store/audioStore';
import { toast } from '@/store/toastStore';
import type {
  CodePayload,
  ConversationMessage,
  SakiLanguage,
  SakiResponse,
  SessionEvent,
  SessionSummary,
} from '@/types/api';

export interface ChatMessage {
  id: string;
  role: 'USER' | 'SAKI';
  text: string;
  language: SakiLanguage | null;
  code: CodePayload | null;
  createdAt: string;
  /** Where the query came from, when it was asked on another device. */
  remote?: boolean;
  /** Local question not yet answered ('sending') or that failed ('failed'). */
  status?: 'sending' | 'failed';
  error?: string;
  /** Voice question: the user's own recording, so they can play it back and check the mic. */
  voice?: { url: string; durationMs: number };
}

type PendingQuery = { kind: 'text'; query: string } | { kind: 'voice'; audio: Blob; durationMs: number };

export interface RemoteActivity {
  inputMode: 'VOICE' | 'TEXT';
  since: number;
}

interface WorkspaceState {
  sessions: SessionSummary[];
  sessionsLoading: boolean;
  activeSessionId: string | null;
  sessionLoading: boolean;
  messages: ChatMessage[];

  editorCode: string;
  editorLanguage: string;
  fileName: string;
  editorDirty: boolean;
  /** Bumps whenever Saki injects code, so the editor can flash/scroll to top. */
  injectionCount: number;

  thinking: boolean;
  /** When the in-flight question was sent, for the thinking timer. */
  thinkingSince: number | null;
  thinkingMode: 'VOICE' | 'TEXT' | null;
  remoteActivity: RemoteActivity | null;

  loadSessions: () => Promise<void>;
  selectSession: (id: string) => Promise<void>;
  createSession: (title?: string) => Promise<void>;
  renameSession: (id: string, title: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;

  setEditorCode: (code: string) => void;
  setEditorLanguage: (language: string) => void;
  setFileName: (fileName: string) => void;
  flushEditorSave: () => Promise<void>;

  /** Opens a local code file in the editor so Saki can read and discuss it. */
  importFile: (fileName: string, content: string) => void;

  sendVoiceQuery: (audio: Blob, durationMs: number) => Promise<SakiResponse | null>;
  sendTextQuery: (query: string) => Promise<SakiResponse | null>;
  retryQuery: (localId: string) => Promise<SakiResponse | null>;
  dismissFailed: (localId: string) => void;
  receiveBroadcast: (response: SakiResponse) => void;
  receiveSessionEvent: (event: SessionEvent) => void;
  reset: () => void;
}

const initialState = {
  sessions: [],
  sessionsLoading: false,
  activeSessionId: null,
  sessionLoading: false,
  messages: [],
  editorCode: '',
  editorLanguage: 'java',
  fileName: defaultFileName('java'),
  editorDirty: false,
  injectionCount: 0,
  thinking: false,
  thinkingSince: null,
  thinkingMode: null,
  remoteActivity: null,
} satisfies Partial<WorkspaceState>;

/** Questions that are in flight or failed, kept so they can be retried. */
const pendingQueries = new Map<string, PendingQuery>();
/** Object URLs for the user's own voice recordings (revoked when the chat is cleared). */
const voiceUrls = new Set<string>();
let localSequence = 0;

function clearLocalState() {
  pendingQueries.clear();
  voiceUrls.forEach((url) => URL.revokeObjectURL(url));
  voiceUrls.clear();
}

let saveTimer: number | undefined;
let loadSessionsInFlight: Promise<void> | null = null;
/** Guards against out-of-order session loads when the user clicks quickly. */
let selectGeneration = 0;

function historyToChat(messages: ConversationMessage[]): ChatMessage[] {
  return messages.map((m) =>
    m.senderRole === 'USER'
      ? {
          id: m.id,
          role: 'USER',
          text: m.userTranscript ?? '',
          language: m.detectedLanguage,
          code: null,
          createdAt: m.createdAt,
        }
      : {
          id: m.id,
          role: 'SAKI',
          text: m.spokenResponse ?? '',
          language: m.detectedLanguage,
          code: {
            hasCode: Boolean(m.codeSnippet),
            code: m.codeSnippet,
            fileName: m.fileName,
            programmingLanguage: m.programmingLanguage,
            explanationMarkdown: m.explanationMarkdown,
          },
          createdAt: m.createdAt,
        },
  );
}

function responseToChat(response: SakiResponse, remote: boolean): ChatMessage[] {
  return [
    {
      id: `${response.messageId}-q`,
      role: 'USER',
      text: response.userTranscript,
      language: response.detectedLanguage,
      code: null,
      createdAt: response.timestamp,
      remote,
    },
    {
      id: response.messageId,
      role: 'SAKI',
      text: response.spokenResponse,
      language: response.detectedLanguage,
      code: response.codePayload,
      createdAt: response.timestamp,
      remote,
    },
  ];
}

export const useWorkspaceStore = create<WorkspaceState>()((set, get) => {
  /**
   * Applies a Saki answer to the open session. Returns false when it belongs to another session.
   * `localId` is the optimistic question bubble to replace with the real transcript.
   */
  const applyResponse = (response: SakiResponse, remote: boolean, localId?: string): boolean => {
    const state = get();
    const sessionIndex = state.sessions.findIndex((s) => s.id === response.sessionId);
    if (sessionIndex >= 0) {
      // Move the session to the top of the sidebar, as the backend orders by updatedAt.
      const sessions = [...state.sessions];
      const [session] = sessions.splice(sessionIndex, 1);
      sessions.unshift({ ...session, updatedAt: response.timestamp });
      set({ sessions });
    }
    if (response.sessionId !== state.activeSessionId) return false;
    if (state.messages.some((m) => m.id === response.messageId)) return false;

    const [question, answer] = responseToChat(response, remote);
    const local = localId ? state.messages.find((m) => m.id === localId) : undefined;
    const update: Partial<WorkspaceState> = {
      messages: local
        ? [...state.messages.map((m) => (m.id === localId ? { ...question, voice: local.voice } : m)), answer]
        : [...state.messages, question, answer],
    };
    const code = response.codePayload;
    if (code.hasCode && code.code) {
      const language = normalizeLanguage(code.programmingLanguage);
      window.clearTimeout(saveTimer);
      Object.assign(update, {
        editorCode: code.code,
        editorLanguage: language,
        fileName: code.fileName || defaultFileName(language),
        editorDirty: false,
        injectionCount: state.injectionCount + 1,
      });
    }
    set(update);
    return true;
  };

  /** Session titles are auto-generated from the first question; refresh the sidebar quietly. */
  const refreshSessionsQuietly = () => {
    sessionApi
      .list()
      .then((sessions) => set({ sessions }))
      .catch(() => undefined);
  };

  /**
   * Shows the question in the chat immediately, then asks Saki. On failure the bubble is
   * marked failed with the reason and can be retried.
   */
  const runQuery = async (pending: PendingQuery, retryId?: string): Promise<SakiResponse | null> => {
    const { activeSessionId: sessionId, editorCode, editorLanguage, thinking } = get();
    if (!sessionId) {
      toast.error('Create or select a chat first.');
      return null;
    }
    if (thinking) return null;

    const localId = retryId ?? `local-${++localSequence}`;
    pendingQueries.set(localId, pending);
    const wasFirstExchange = !get().messages.some((m) => !m.status);
    if (retryId) {
      set({
        messages: get().messages.map((m) => (m.id === localId ? { ...m, status: 'sending', error: undefined } : m)),
      });
    } else {
      let voice: ChatMessage['voice'];
      if (pending.kind === 'voice') {
        const url = URL.createObjectURL(pending.audio);
        voiceUrls.add(url);
        voice = { url, durationMs: pending.durationMs };
      }
      const question: ChatMessage = {
        id: localId,
        role: 'USER',
        text: pending.kind === 'text' ? pending.query : '',
        language: null,
        code: null,
        createdAt: new Date().toISOString(),
        status: 'sending',
        voice,
      };
      set({ messages: [...get().messages, question] });
    }
    set({ thinking: true, thinkingSince: Date.now(), thinkingMode: pending.kind === 'voice' ? 'VOICE' : 'TEXT' });

    try {
      const response =
        pending.kind === 'text'
          ? await assistantApi.textQuery({
              sessionId,
              query: pending.query,
              currentEditorCode: editorCode,
              programmingLanguage: editorLanguage,
              clientId: CLIENT_ID,
            })
          : await assistantApi.voiceQuery({
              sessionId,
              audio: pending.audio,
              currentEditorCode: editorCode,
              programmingLanguage: editorLanguage,
              clientId: CLIENT_ID,
            });
      pendingQueries.delete(localId);
      if (applyResponse(response, false, localId)) {
        useAudioStore.getState().playResponse(response);
      }
      if (wasFirstExchange) refreshSessionsQuietly();
      return response;
    } catch (error) {
      if (get().activeSessionId === sessionId) {
        set({
          messages: get().messages.map((m) =>
            m.id === localId ? { ...m, status: 'failed', error: errorMessage(error) } : m,
          ),
        });
      }
      return null;
    } finally {
      set({ thinking: false, thinkingSince: null, thinkingMode: null });
    }
  };

  const doLoadSessions = async () => {
    set({ sessionsLoading: true });
    try {
      const sessions = await sessionApi.list();
      set({ sessions });
      const { activeSessionId } = get();
      if (activeSessionId && sessions.some((s) => s.id === activeSessionId)) return;
      if (sessions.length > 0) await get().selectSession(sessions[0].id);
      else await get().createSession();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      set({ sessionsLoading: false });
    }
  };

  return {
    ...initialState,

    loadSessions: () => {
      // Concurrent callers (e.g. React StrictMode's double mount) share one load, so an
      // empty account never gets two empty chats created.
      loadSessionsInFlight ??= doLoadSessions().finally(() => {
        loadSessionsInFlight = null;
      });
      return loadSessionsInFlight;
    },

    selectSession: async (id) => {
      if (get().activeSessionId === id && !get().sessionLoading) return;
      await get().flushEditorSave();
      const generation = ++selectGeneration;
      useAudioStore.getState().stop();
      clearLocalState();
      set({ activeSessionId: id, sessionLoading: true, messages: [], remoteActivity: null });
      try {
        const [session, history] = await Promise.all([sessionApi.get(id), sessionApi.messages(id)]);
        if (generation !== selectGeneration) return;
        const language = normalizeLanguage(session.activeLanguage ?? 'java');
        const lastWithFile = [...history].reverse().find((m) => m.senderRole === 'SAKI' && m.fileName);
        set({
          messages: historyToChat(history),
          editorCode: session.currentCodeContext ?? '',
          editorLanguage: language,
          fileName: lastWithFile?.fileName ?? defaultFileName(language),
          editorDirty: false,
        });
      } catch (error) {
        if (generation === selectGeneration) toast.error(errorMessage(error));
      } finally {
        if (generation === selectGeneration) set({ sessionLoading: false });
      }
    },

    createSession: async (title) => {
      // Already on an empty chat: reuse it instead of piling up empty chats.
      const { activeSessionId, messages, editorCode, sessionLoading } = get();
      if (!title && activeSessionId && !sessionLoading && messages.length === 0 && !editorCode.trim()) return;
      try {
        const session = await sessionApi.create(title, get().editorLanguage);
        set({ sessions: [session, ...get().sessions] });
        await get().selectSession(session.id);
      } catch (error) {
        toast.error(errorMessage(error));
      }
    },

    renameSession: async (id, title) => {
      try {
        const updated = await sessionApi.update(id, { title });
        set({ sessions: get().sessions.map((s) => (s.id === id ? { ...s, title: updated.title } : s)) });
      } catch (error) {
        toast.error(errorMessage(error));
      }
    },

    deleteSession: async (id) => {
      try {
        await sessionApi.remove(id);
        const sessions = get().sessions.filter((s) => s.id !== id);
        set({ sessions });
        if (get().activeSessionId === id) {
          window.clearTimeout(saveTimer);
          set({ activeSessionId: null, messages: [], editorCode: '', editorDirty: false });
          if (sessions.length > 0) await get().selectSession(sessions[0].id);
          else await get().createSession();
        }
      } catch (error) {
        toast.error(errorMessage(error));
      }
    },

    setEditorCode: (code) => {
      if (code === get().editorCode) return;
      set({ editorCode: code, editorDirty: true });
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => void get().flushEditorSave(), EDITOR_SAVE_DEBOUNCE_MS);
    },

    setEditorLanguage: (language) => {
      const id = get().activeSessionId;
      const previousDefault = defaultFileName(get().editorLanguage);
      set({
        editorLanguage: language,
        // Keep a user/Saki-chosen file name; only follow the language for generic defaults.
        fileName: get().fileName === previousDefault ? defaultFileName(language) : get().fileName,
      });
      if (id) sessionApi.update(id, { activeLanguage: language }).catch((e) => toast.error(errorMessage(e)));
    },

    setFileName: (fileName) => set({ fileName }),

    importFile: (fileName, content) => {
      const language = languageFromFileName(fileName);
      if (language !== get().editorLanguage) get().setEditorLanguage(language);
      set({ fileName, injectionCount: get().injectionCount + 1 });
      get().setEditorCode(content);
    },

    flushEditorSave: async () => {
      window.clearTimeout(saveTimer);
      const { activeSessionId, editorDirty, editorCode, editorLanguage } = get();
      if (!activeSessionId || !editorDirty) return;
      set({ editorDirty: false });
      try {
        await sessionApi.update(activeSessionId, { currentCodeContext: editorCode, activeLanguage: editorLanguage });
      } catch (error) {
        if (get().activeSessionId === activeSessionId) set({ editorDirty: true });
        toast.error(`Could not save editor code: ${errorMessage(error)}`);
      }
    },

    sendVoiceQuery: (audio, durationMs) => runQuery({ kind: 'voice', audio, durationMs }),

    sendTextQuery: (query) => runQuery({ kind: 'text', query }),

    retryQuery: (localId) => {
      const pending = pendingQueries.get(localId);
      return pending ? runQuery(pending, localId) : Promise.resolve(null);
    },

    dismissFailed: (localId) => {
      pendingQueries.delete(localId);
      set({ messages: get().messages.filter((m) => m.id !== localId) });
    },

    receiveBroadcast: (response) => {
      if (response.originClientId === CLIENT_ID) return; // Already handled from the HTTP response.
      const wasEmpty = get().messages.length === 0;
      set({ remoteActivity: null });
      if (applyResponse(response, true)) {
        useAudioStore.getState().playResponse(response);
        if (response.codePayload.hasCode) {
          toast.info(`Saki sent ${response.codePayload.fileName ?? 'new code'} from your companion device`);
        }
      }
      if (wasEmpty) refreshSessionsQuietly();
    },

    receiveSessionEvent: (event) => {
      if (event.originClientId === CLIENT_ID || event.sessionId !== get().activeSessionId) return;
      if (event.type === 'PROCESSING') {
        set({ remoteActivity: { inputMode: event.inputMode, since: Date.now() } });
      } else {
        set({ remoteActivity: null });
        if (event.type === 'FAILED' && event.message) toast.error(`Companion query failed: ${event.message}`);
      }
    },

    reset: () => {
      window.clearTimeout(saveTimer);
      selectGeneration++;
      clearLocalState();
      set({ ...initialState });
    },
  };
});
