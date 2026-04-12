'use client';

import * as Ably from 'ably';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  LOBBY_UPDATED_EVENT,
  getLobbyChannelName,
  type LobbyRealtimeEvent,
  type LobbyState
} from '@decoy/types';
import { FALLBACK_POLL_MS, api } from '../lib/lobby-client';

export function useLobby(code: string) {
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latestLobbyRef = useRef<LobbyState | null>(null);
  const normalizedCode = code.toUpperCase();

  useEffect(() => {
    latestLobbyRef.current = lobby;
  }, [lobby]);

  const applyLobbySnapshot = useCallback((nextLobby: LobbyState | null) => {
    if (!nextLobby) {
      setLobby(null);
      return;
    }

    setLobby((current) => {
      if (!current || nextLobby.revision >= current.revision) {
        return nextLobby;
      }

      return current;
    });
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await api<{ lobby: LobbyState }>(`/api/lobbies/${normalizedCode}`);
      applyLobbySnapshot(data.lobby);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to load lobby.');
      if (!latestLobbyRef.current) {
        setLobby(null);
      }
    } finally {
      setLoading(false);
    }
  }, [applyLobbySnapshot, normalizedCode]);

  useEffect(() => {
    void refresh();

    const intervalId = window.setInterval(() => {
      void refresh();
    }, FALLBACK_POLL_MS);

    const refreshOnFocus = () => {
      void refresh();
    };
    const refreshOnVisible = () => {
      if (document.visibilityState === 'visible') {
        void refresh();
      }
    };

    window.addEventListener('focus', refreshOnFocus);
    document.addEventListener('visibilitychange', refreshOnVisible);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshOnFocus);
      document.removeEventListener('visibilitychange', refreshOnVisible);
    };
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;

    const realtime = new Ably.Realtime({
      authCallback: async (_tokenParams, callback) => {
        try {
          const response = await fetch(`/api/lobbies/${normalizedCode}/realtime-auth`, {
            method: 'POST',
            cache: 'no-store'
          });
          const tokenRequest = (await response.json().catch(() => ({}))) as { error?: string };

          if (!response.ok) {
            throw new Error(tokenRequest.error ?? 'Unable to authorize realtime sync.');
          }

          callback(null, tokenRequest as Ably.TokenRequest);
        } catch (nextError) {
          callback(
            nextError instanceof Error ? nextError.message : 'Unable to authorize realtime sync.',
            null
          );
        }
      },
      autoConnect: true,
      closeOnUnload: true
    });

    const channel = realtime.channels.get(getLobbyChannelName(normalizedCode));
    const handleMessage = (message: { data?: LobbyRealtimeEvent }) => {
      if (cancelled) return;

      const event = message.data;
      if (!event?.lobby || event.code !== normalizedCode) return;

      applyLobbySnapshot(event.lobby);
      setError(null);
      setLoading(false);
    };

    const handleRecovery = () => {
      void refresh();
    };
    const handleConnectionIssue = (stateChange: { reason?: { message?: string } }) => {
      console.warn('Realtime sync unavailable, using fallback refresh.', {
        code: normalizedCode,
        reason: stateChange.reason?.message ?? 'Unknown connection issue'
      });
    };

    realtime.connection.on('connected', handleRecovery);
    realtime.connection.on('suspended', handleConnectionIssue);
    realtime.connection.on('failed', handleConnectionIssue);

    channel.subscribe(LOBBY_UPDATED_EVENT, handleMessage).catch((nextError) => {
      console.warn('Could not subscribe to lobby updates, using fallback refresh.', {
        code: normalizedCode,
        error: nextError
      });
    });

    return () => {
      cancelled = true;
      channel.unsubscribe(LOBBY_UPDATED_EVENT, handleMessage);
      realtime.connection.off('connected', handleRecovery);
      realtime.connection.off('suspended', handleConnectionIssue);
      realtime.connection.off('failed', handleConnectionIssue);
      realtime.close();
    };
  }, [applyLobbySnapshot, normalizedCode, refresh]);

  return { lobby, loading, error, refresh, setLobby: applyLobbySnapshot };
}
