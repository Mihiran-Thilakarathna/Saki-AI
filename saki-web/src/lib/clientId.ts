/**
 * Per-tab identifier sent as `clientId` with every query. The backend echoes it as
 * `originClientId` on the WebSocket broadcast so this tab can skip its own echo.
 */
export const CLIENT_ID = `web-${crypto.randomUUID()}`;
