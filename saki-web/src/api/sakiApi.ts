import { apiRequest } from '@/lib/apiClient';
import type {
  AuthProviders,
  AuthResponse,
  CodingSession,
  ConversationMessage,
  GoogleLoginRequest,
  LoginRequest,
  RegisterRequest,
  SakiResponse,
  SessionSummary,
  TextQueryRequest,
  UpdateSessionRequest,
  UserProfile,
} from '@/types/api';

export const authApi = {
  login: (request: LoginRequest) =>
    apiRequest<AuthResponse>('/api/v1/auth/login', { method: 'POST', json: request, auth: false }),
  register: (request: RegisterRequest) =>
    apiRequest<AuthResponse>('/api/v1/auth/register', { method: 'POST', json: request, auth: false }),
  google: (request: GoogleLoginRequest) =>
    apiRequest<AuthResponse>('/api/v1/auth/google', { method: 'POST', json: request, auth: false }),
  providers: () => apiRequest<AuthProviders>('/api/v1/auth/providers', { auth: false }),
  me: () => apiRequest<UserProfile>('/api/v1/auth/me'),
};

export const sessionApi = {
  list: () => apiRequest<SessionSummary[]>('/api/v1/sessions'),
  create: (title?: string, activeLanguage?: string) =>
    apiRequest<CodingSession>('/api/v1/sessions', { method: 'POST', json: { title, activeLanguage } }),
  get: (id: string) => apiRequest<CodingSession>(`/api/v1/sessions/${id}`),
  update: (id: string, request: UpdateSessionRequest) =>
    apiRequest<CodingSession>(`/api/v1/sessions/${id}`, { method: 'PATCH', json: request }),
  remove: (id: string) => apiRequest<void>(`/api/v1/sessions/${id}`, { method: 'DELETE' }),
  /** Deletes every chat of the signed-in user. */
  removeAll: () => apiRequest<void>('/api/v1/sessions', { method: 'DELETE' }),
  messages: (id: string) => apiRequest<ConversationMessage[]>(`/api/v1/sessions/${id}/messages`),
};

export interface VoiceQueryInput {
  sessionId: string;
  audio: Blob;
  currentEditorCode?: string;
  programmingLanguage?: string;
  clientId: string;
}

export const assistantApi = {
  voiceQuery: ({ sessionId, audio, currentEditorCode, programmingLanguage, clientId }: VoiceQueryInput) => {
    const form = new FormData();
    form.append('audioFile', audio, `saki-query.${extensionFor(audio.type)}`);
    form.append('sessionId', sessionId);
    form.append('clientId', clientId);
    if (currentEditorCode !== undefined) form.append('currentEditorCode', currentEditorCode);
    if (programmingLanguage) form.append('programmingLanguage', programmingLanguage);
    return apiRequest<SakiResponse>('/api/v1/saki/voice-query', { method: 'POST', body: form });
  },
  textQuery: (request: TextQueryRequest) =>
    apiRequest<SakiResponse>('/api/v1/saki/text-query', { method: 'POST', json: request }),
};

function extensionFor(mimeType: string): string {
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'm4a';
  if (mimeType.includes('wav')) return 'wav';
  return 'webm';
}
