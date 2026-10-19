// TypeScript mirrors of the saki-backend DTOs.

export type SakiLanguage = 'si-LK' | 'en-US';

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  preferredLanguage: SakiLanguage;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: UserProfile;
}

export interface RegisterRequest {
  fullName: string;
  email: string;
  password: string;
  preferredLanguage: SakiLanguage;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface GoogleLoginRequest {
  idToken: string;
  preferredLanguage?: SakiLanguage;
}

export interface AuthProviders {
  googleEnabled: boolean;
  googleClientId: string | null;
}

export interface SessionSummary {
  id: string;
  title: string;
  activeLanguage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CodingSession extends SessionSummary {
  currentCodeContext: string | null;
}

export interface UpdateSessionRequest {
  title?: string;
  activeLanguage?: string;
  currentCodeContext?: string;
}

export type SenderRole = 'USER' | 'SAKI';

export interface ConversationMessage {
  id: string;
  sessionId: string;
  senderRole: SenderRole;
  userTranscript: string | null;
  detectedLanguage: SakiLanguage | null;
  spokenResponse: string | null;
  codeSnippet: string | null;
  programmingLanguage: string | null;
  fileName: string | null;
  explanationMarkdown: string | null;
  createdAt: string;
}

export interface CodePayload {
  hasCode: boolean;
  programmingLanguage: string | null;
  fileName: string | null;
  code: string | null;
  explanationMarkdown: string | null;
}

export interface SakiResponse {
  sessionId: string;
  messageId: string;
  userTranscript: string;
  detectedLanguage: SakiLanguage;
  spokenResponse: string;
  audioBase64: string | null;
  audioMimeType: string | null;
  /** True when the voice is still being synthesized; it follows as a {@link SakiAudio}. */
  audioPending?: boolean;
  codePayload: CodePayload;
  timestamp: string;
  originClientId: string | null;
}

/** Voice for an earlier answer, from /topic/session/{id}/audio (null audio = TTS failed). */
export interface SakiAudio {
  sessionId: string;
  messageId: string;
  audioBase64: string | null;
  audioMimeType: string | null;
  originClientId: string | null;
}

export interface TextQueryRequest {
  sessionId: string;
  query: string;
  currentEditorCode?: string;
  programmingLanguage?: string;
  clientId?: string;
}

export type SessionEventType = 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface SessionEvent {
  type: SessionEventType;
  sessionId: string;
  inputMode: 'VOICE' | 'TEXT';
  originClientId: string | null;
  message: string | null;
  timestamp: string;
}

/** RFC 9457 ProblemDetail as produced by GlobalExceptionHandler. */
export interface ProblemDetail {
  status: number;
  title?: string;
  detail?: string;
  errorCode?: string;
  fieldErrors?: Record<string, string>;
}
