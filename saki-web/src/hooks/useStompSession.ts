import { useEffect, useRef, useState } from 'react';
import { Client, type IMessage, type StompSubscription } from '@stomp/stompjs';
import { WS_URL } from '@/config';
import { useWorkspaceStore } from '@/store/workspaceStore';
import type { SakiAudio, SakiResponse, SessionEvent } from '@/types/api';
import { useAudioStore } from '@/store/audioStore';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

function parse<T>(message: IMessage): T | null {
  try {
    return JSON.parse(message.body) as T;
  } catch {
    return null;
  }
}

/**
 * Keeps one authenticated STOMP connection for the logged-in user and subscribes to the
 * active session's topics, so answers asked from the Flutter companion land here live.
 */
export function useStompSession(token: string | null, sessionId: string | null): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [client, setClient] = useState<Client | null>(null);
  const [connectedAt, setConnectedAt] = useState(0);
  const subscriptions = useRef<StompSubscription[]>([]);

  // One client per JWT.
  useEffect(() => {
    if (!token) return;
    const stomp = new Client({
      brokerURL: WS_URL,
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 3000,
      heartbeatIncoming: 10_000,
      heartbeatOutgoing: 10_000,
      onConnect: () => {
        setStatus('connected');
        setConnectedAt(Date.now()); // Re-subscribe after every (re)connect.
      },
      onWebSocketClose: () => setStatus('connecting'),
      onStompError: (frame) => {
        console.warn('STOMP error', frame.headers.message);
        setStatus('connecting');
      },
    });
    setStatus('connecting');
    stomp.activate();
    setClient(stomp);
    return () => {
      subscriptions.current = [];
      setClient(null);
      setStatus('disconnected');
      void stomp.deactivate();
    };
  }, [token]);

  // Subscribe to the active session; re-run on session change and on reconnect.
  useEffect(() => {
    if (!client || !client.connected || !sessionId) return;
    const { receiveBroadcast, receiveSessionEvent } = useWorkspaceStore.getState();
    subscriptions.current = [
      client.subscribe(`/topic/session/${sessionId}`, (message) => {
        const response = parse<SakiResponse>(message);
        if (response) receiveBroadcast(response);
      }),
      client.subscribe(`/topic/session/${sessionId}/events`, (message) => {
        const event = parse<SessionEvent>(message);
        if (event) receiveSessionEvent(event);
      }),
      client.subscribe(`/topic/session/${sessionId}/audio`, (message) => {
        const audio = parse<SakiAudio>(message);
        if (audio) useAudioStore.getState().receiveAudio(audio);
      }),
    ];
    return () => {
      if (client.connected) subscriptions.current.forEach((s) => s.unsubscribe());
      subscriptions.current = [];
    };
  }, [client, sessionId, connectedAt]);

  return status;
}
