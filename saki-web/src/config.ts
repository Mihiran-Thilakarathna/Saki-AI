const trimSlash = (value: string) => value.replace(/\/+$/, '');

/** REST base URL. Empty means same origin (Vite dev proxy or a reverse proxy in production). */
export const API_BASE_URL = trimSlash(import.meta.env.VITE_API_BASE_URL ?? '');

/** STOMP WebSocket endpoint (native WebSocket, matches the backend's /ws endpoint). */
export const WS_URL = (() => {
  const configured = import.meta.env.VITE_WS_URL;
  if (configured) return configured;
  if (API_BASE_URL) return `${API_BASE_URL.replace(/^http/, 'ws')}/ws`;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
})();

/** Debounce before persisting manual editor edits to the session. */
export const EDITOR_SAVE_DEBOUNCE_MS = 1500;

/** Hard cap on a single voice recording. */
export const MAX_RECORDING_MS = 60_000;
