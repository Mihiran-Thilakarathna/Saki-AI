import { API_BASE_URL } from '@/config';
import type { ProblemDetail } from '@/types/api';

export class ApiError extends Error {
  readonly status: number;
  readonly errorCode: string;
  readonly fieldErrors: Record<string, string>;

  constructor(status: number, errorCode: string, message: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errorCode = errorCode;
    this.fieldErrors = fieldErrors;
  }
}

type TokenProvider = () => string | null;
type UnauthorizedHandler = () => void;

let tokenProvider: TokenProvider = () => null;
let onUnauthorized: UnauthorizedHandler = () => {};

/** Wired once by the auth store so every request carries the JWT and 401s log the user out. */
export function configureApiClient(provider: TokenProvider, unauthorized: UnauthorizedHandler) {
  tokenProvider = provider;
  onUnauthorized = unauthorized;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  json?: unknown;
  body?: BodyInit;
  signal?: AbortSignal;
  auth?: boolean;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', json, body, signal, auth = true } = options;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (json !== undefined) headers['Content-Type'] = 'application/json';
  const token = auth ? tokenProvider() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: json !== undefined ? JSON.stringify(json) : body,
      signal,
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach Saki’s server. Check your connection and try again.');
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const data = text ? safeJson(text) : null;

  if (!response.ok) {
    const problem = (data ?? {}) as Partial<ProblemDetail>;
    if (response.status === 401 && auth && token) onUnauthorized();
    // No ProblemDetail body: a proxy answered because the backend is down or restarting.
    const fallback =
      response.status >= 500
        ? 'Saki’s server is not reachable right now. Please try again in a moment.'
        : response.statusText || 'Request failed';
    throw new ApiError(
      response.status,
      problem.errorCode ?? `HTTP_${response.status}`,
      problem.detail ?? fallback,
      problem.fieldErrors ?? {},
    );
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const firstField = Object.values(error.fieldErrors)[0];
    return firstField ? `${error.message}: ${firstField}` : error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong';
}
