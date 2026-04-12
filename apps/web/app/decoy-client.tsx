'use client';

import * as Ably from 'ably';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ROUND_COUNT_OPTIONS,
  allSubmissionsComplete,
  allVotesComplete,
  getDeckCatalog
} from '@decoy/game-engine';
import {
  LOBBY_UPDATED_EVENT,
  getLobbyChannelName,
  type DeckDefinition,
  type LobbyMembership,
  type LobbyRealtimeEvent,
  type LobbyState,
  type Player,
  type RoundCount,
  type RoundState
} from '@decoy/types';
import { Surface } from '@decoy/ui';

const PLAYER_KEY = 'decoy.player.identity.v2';
const FALLBACK_POLL_MS = 30000;
const DECKS = getDeckCatalog();

function scoreRows(players: Player[], scores: Record<string, number>) {
  return [...players].sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0));
}

function getStoredMemberships(): Record<string, LobbyMembership> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(PLAYER_KEY);
    return raw ? (JSON.parse(raw) as Record<string, LobbyMembership>) : {};
  } catch {
    return {};
  }
}

function getStoredMembership(code: string) {
  return getStoredMemberships()[code.toUpperCase()] ?? null;
}

function storeMembership(membership: LobbyMembership) {
  if (typeof window === 'undefined') return;
  const current = getStoredMemberships();
  current[membership.code.toUpperCase()] = {
    ...membership,
    code: membership.code.toUpperCase()
  };
  window.localStorage.setItem(PLAYER_KEY, JSON.stringify(current));
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {})
    },
    cache: 'no-store'
  });

  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? 'Request failed.');
  }
  return data;
}

function useLobby(code: string) {
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

function roundTitle(round: RoundState) {
  return round.archetype === 'bluff_trivia' ? 'Bluff trivia' : 'Opinion vote';
}

function deckArchetypeLabel(archetype: DeckDefinition['archetype']) {
  return archetype === 'bluff_trivia' ? 'Bluff trivia' : 'Opinion vote';
}

function deckFor(deckId: string) {
  return DECKS.find((deck) => deck.id === deckId) ?? DECKS[0];
}

function DeckTypeIcon({ archetype }: { archetype: DeckDefinition['archetype'] }) {
  if (archetype === 'bluff_trivia') {
    return (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path
          d="M5.5 4.75h9a1.75 1.75 0 0 1 1.75 1.75v7a1.75 1.75 0 0 1-1.75 1.75h-9A1.75 1.75 0 0 1 3.75 13.5v-7A1.75 1.75 0 0 1 5.5 4.75Z"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path d="M7 8.25h6M7 11.25h3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="13.75" cy="11.25" r="0.75" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M10 16.25c3.452 0 6.25-2.35 6.25-5.25S13.452 5.75 10 5.75 3.75 8.1 3.75 11c0 1.378.637 2.632 1.68 3.568.23.205.36.498.34.806l-.098 1.48 1.783-.9c.23-.117.495-.145.748-.08.565.146 1.167.226 1.797.226Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="7.5" cy="11" r="0.9" fill="currentColor" />
      <circle cx="10" cy="11" r="0.9" fill="currentColor" />
      <circle cx="12.5" cy="11" r="0.9" fill="currentColor" />
    </svg>
  );
}

function DeckTypePill({ archetype }: { archetype: DeckDefinition['archetype'] }) {
  return (
    <span className="deck-type-pill">
      <span className="deck-type-pill-icon">
        <DeckTypeIcon archetype={archetype} />
      </span>
      {deckArchetypeLabel(archetype)}
    </span>
  );
}

function DeckCard({
  deck,
  active,
  disabled,
  onClick,
  footer,
  imageTestId,
  showSelectedBadge = active
}: {
  deck: DeckDefinition;
  active: boolean;
  disabled?: boolean;
  onClick?: () => void;
  footer?: ReactNode;
  imageTestId?: string;
  showSelectedBadge?: boolean;
}) {
  const content = (
    <>
      <div className="deck-card-top">
        <img
          className="deck-card-art"
          src={deck.imagePath}
          alt={imageTestId ? deck.name : ''}
          aria-hidden={imageTestId ? undefined : true}
          data-testid={imageTestId}
        />
        <div className="deck-card-info stack-xs">
          <div className="space-between wrap gap-sm">
            <strong className="deck-card-name">{deck.name}</strong>
            {showSelectedBadge ? <span className="deck-card-selected">Selected</span> : null}
          </div>
          <div className="pill-row">
            <DeckTypePill archetype={deck.archetype} />
            {deck.isAdult ? <span className="pill">Adult</span> : null}
          </div>
        </div>
      </div>
      <p className="deck-card-description">{deck.description}</p>
      {footer ? <div className="deck-card-footer">{footer}</div> : null}
    </>
  );

  if (!onClick) {
    return <div className={`deck-card ${active ? 'deck-card-active' : ''}`}>{content}</div>;
  }

  return (
    <button
      type="button"
      className={`deck-card deck-card-button ${active ? 'deck-card-active' : ''}`}
      data-testid={`deck-card-${deck.id}`}
      disabled={disabled}
      onClick={onClick}
    >
      {content}
    </button>
  );
}

export function LandingClient() {
  const [hostName, setHostName] = useState('Sumit');
  const [joinCode, setJoinCode] = useState('');

  return (
    <main className="app-shell">
      <section className="hero hero-simple">
        <div className="container stack-lg">
          <div className="hero-copy stack-md">
            <img className="brand-lockup" src="/branding/decoy-logo.svg" alt="Decoy" />
            <span className="badge">Web-first social bluffing party game</span>
            <h1 className="h1">One fake answer. Everybody hunting for it.</h1>
            <p className="lead">
              Create a room, pick a themed deck, lock in five, seven, or ten rounds, and let the room bluff in realtime.
            </p>
          </div>

          <div className="grid landing-grid">
            <Surface>
              <div className="panel stack-md">
                <p className="eyebrow">Create lobby</p>
                <label className="stack-xs">
                  <span>Host name</span>
                  <input value={hostName} onChange={(event) => setHostName(event.target.value)} placeholder="Host name" />
                </label>
                <a className="button button-primary" href={`/create?host=${encodeURIComponent(hostName || 'Host')}`}>
                  Create lobby
                </a>
              </div>
            </Surface>

            <Surface>
              <div className="panel stack-md">
                <p className="eyebrow">Join lobby</p>
                <label className="stack-xs">
                  <span>Room code</span>
                  <input value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} placeholder="ABCD" maxLength={4} />
                </label>
                <a className="button button-secondary" href={`/join?code=${encodeURIComponent(joinCode)}`}>
                  Join by code
                </a>
              </div>
            </Surface>
          </div>
        </div>
      </section>
    </main>
  );
}

export function CreateLobbyClient({ hostName }: { hostName: string }) {
  const [createdLobbyCode, setCreatedLobbyCode] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const create = async () => {
      try {
        const data = await api<{ lobby: LobbyState; player: Player; membership: LobbyMembership }>('/api/lobbies', {
          method: 'POST',
          body: JSON.stringify({ hostName })
        });
        storeMembership(data.membership);
        if (!cancelled) {
          setCreatedLobbyCode(data.lobby.code);
        }
      } catch (error) {
        if (!cancelled) {
          setStatus(error instanceof Error ? error.message : 'Unable to create lobby.');
        }
      }
    };

    void create();
    return () => {
      cancelled = true;
    };
  }, [hostName]);

  if (status) {
    return (
      <main className="app-shell">
        <div className="container narrow stack-lg section-pad">
          <Surface>
            <div className="panel stack-md">
              <h1 className="section-title">Couldn’t create lobby</h1>
              <p className="status-error">{status}</p>
              <a className="button button-secondary" href="/">Back home</a>
            </div>
          </Surface>
        </div>
      </main>
    );
  }

  if (!createdLobbyCode) {
    return (
      <main className="app-shell">
        <div className="container narrow stack-lg section-pad">
          <Surface>
            <div className="panel stack-md loading-panel">
              <div className="loading-badge" aria-hidden="true">
                <span className="loading-dot" />
                <span className="loading-dot" />
                <span className="loading-dot" />
              </div>
              <p className="eyebrow">Creating lobby</p>
              <h1 className="section-title">Setting up your room</h1>
              <p className="muted">
                Reserving a code for <strong>{hostName || 'Host'}</strong> and preparing the first browser session.
              </p>
            </div>
          </Surface>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <div className="container narrow stack-lg section-pad">
        <Surface>
          <div className="panel stack-md">
            <p className="eyebrow">Lobby created</p>
            <h1 className="section-title">Room code {createdLobbyCode}</h1>
            <p className="muted">Share the code. Everyone can join from their own browser now.</p>
            <div className="actions">
              <a className="button button-primary" href={`/lobby/${createdLobbyCode}`}>Open lobby</a>
              <a className="button button-secondary" href="/">Back home</a>
            </div>
          </div>
        </Surface>
      </div>
    </main>
  );
}

export function JoinLobbyClient({ initialCode }: { initialCode: string }) {
  const [code, setCode] = useState(initialCode.toUpperCase());
  const [name, setName] = useState('');
  const membership = useMemo(() => getStoredMembership(code), [code]);

  useEffect(() => {
    if (membership?.playerName) {
      setName((current) => current || membership.playerName);
    }
  }, [membership]);
  const [status, setStatus] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const join = async () => {
    setJoining(true);
    setStatus(null);
    try {
      const data = await api<{ player: Player; membership: LobbyMembership }>(`/api/lobbies/${code}/join`, {
        method: 'POST',
        body: JSON.stringify({ name, playerSessionToken: membership?.playerSessionToken })
      });
      storeMembership(data.membership);
      window.location.href = `/lobby/${code.toUpperCase()}`;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to join lobby.');
    } finally {
      setJoining(false);
    }
  };

  return (
    <main className="app-shell">
      <div className="container narrow stack-lg section-pad">
        <Surface>
          <div className="panel stack-md">
            <p className="eyebrow">Join lobby</p>
            <label className="stack-xs">
              <span>Room code</span>
              <input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} maxLength={4} />
            </label>
            <label className="stack-xs">
              <span>Your name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={membership?.playerName ?? 'Riya'}
              />
            </label>
            {membership ? <p className="muted">This browser will resume its existing seat for room {code || '----'}.</p> : null}
            {status ? <p className="status-error">{status}</p> : null}
            <div className="actions">
              <button className="button button-primary" onClick={join} disabled={joining}>Join lobby</button>
              <a className="button button-secondary" href="/">Back home</a>
            </div>
          </div>
        </Surface>
      </div>
    </main>
  );
}

export function LobbyClient({
  code,
  screen = 'lobby'
}: {
  code: string;
  screen?: 'lobby' | 'decks';
}) {
  const { lobby, loading, error, refresh, setLobby } = useLobby(code.toUpperCase());
  const [membership, setMembership] = useState<LobbyMembership | null>(null);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [optimisticSubmission, setOptimisticSubmission] = useState<{ key: string; text: string } | null>(null);
  const [optimisticVote, setOptimisticVote] = useState<{ key: string; optionId: string } | null>(null);

  useEffect(() => {
    setMembership(getStoredMembership(code));
  }, [code]);

  const playerId = membership?.playerId ?? null;
  const me = useMemo(() => lobby?.players.find((player) => player.id === playerId) ?? null, [lobby, playerId]);
  const isHost = Boolean(me && lobby && me.id === lobby.hostPlayerId);
  const selectedDeck = useMemo(
    () => deckFor(lobby?.game?.deckId ?? lobby?.config.deckId ?? DECKS[0].id),
    [lobby]
  );
  const selectedRoundCount = lobby?.game?.roundCount ?? lobby?.config.roundCount ?? ROUND_COUNT_OPTIONS[0];
  const deckBrowserHref = `/lobby/${code.toUpperCase()}/decks`;
  const lobbyHref = `/lobby/${code.toUpperCase()}`;
  const currentRound = lobby?.game?.rounds[lobby.game.roundIndex];
  const draftRoundKey = useMemo(() => {
    if (!lobby?.game || !currentRound || !playerId) return null;
    return `${lobby.game.id}:${lobby.game.roundIndex}:${currentRound.phase}:${playerId}`;
  }, [currentRound, lobby?.game, playerId]);
  const existingSubmission = useMemo(() => {
    if (!currentRound || !playerId) return '';
    return currentRound.submissions.find((submission) => submission.playerId === playerId)?.text ?? '';
  }, [currentRound, playerId]);
  const sortedScores = useMemo(() => {
    if (!lobby?.game) return [];
    return scoreRows(lobby.game.players, lobby.game.scores);
  }, [lobby]);
  const submissionKey = useMemo(() => {
    if (!lobby?.game || !currentRound || !playerId || currentRound.phase !== 'submission') return null;
    return `${lobby.game.id}:${lobby.game.roundIndex}:submission:${playerId}`;
  }, [currentRound, lobby?.game, playerId]);
  const effectiveSubmittedText = submissionKey && optimisticSubmission?.key === submissionKey
    ? optimisticSubmission.text
    : existingSubmission;
  const hasSubmittedAnswer = Boolean(effectiveSubmittedText.trim());
  const votingKey = useMemo(() => {
    if (!lobby?.game || !currentRound || !playerId || currentRound.phase !== 'voting') return null;
    return `${lobby.game.id}:${lobby.game.roundIndex}:voting:${playerId}`;
  }, [currentRound, lobby?.game, playerId]);
  const effectiveVoteOptionId = votingKey && optimisticVote?.key === votingKey
    ? optimisticVote.optionId
    : (playerId ? currentRound?.votes[playerId] ?? null : null);

  useEffect(() => {
    setDraft(existingSubmission);
  }, [draftRoundKey, existingSubmission]);

  const runAction = useCallback(async (action: string, path: string, body: Record<string, string> = {}) => {
    if (!membership?.playerSessionToken) {
      setStatus('Join this lobby from this browser first.');
      return false;
    }

    setBusyAction(action);
    setStatus(null);
    try {
      const data = await api<{ lobby?: LobbyState }>(path, {
        method: 'POST',
        body: JSON.stringify({ ...body, playerSessionToken: membership.playerSessionToken })
      });
      if (data.lobby) {
        setLobby(data.lobby);
      } else {
        await refresh();
      }
      return true;
    } catch (nextError) {
      setStatus(nextError instanceof Error ? nextError.message : 'Action failed.');
      return false;
    } finally {
      setBusyAction(null);
    }
  }, [membership, refresh, setLobby]);

  const submitCurrentAnswer = useCallback(async () => {
    if (!lobby || !submissionKey) return;

    const text = draft.trim();
    if (!text) {
      setStatus('Enter an answer first.');
      return;
    }

    setOptimisticSubmission({ key: submissionKey, text });
    const succeeded = await runAction('submit', `/api/lobbies/${lobby.code}/submit`, { text });
    if (!succeeded) {
      setOptimisticSubmission((current) => (current?.key === submissionKey ? null : current));
    }
  }, [draft, lobby, runAction, submissionKey]);

  const submitVoteChoice = useCallback(async (optionId: string) => {
    if (!lobby || !votingKey) return;

    setOptimisticVote({ key: votingKey, optionId });
    const succeeded = await runAction('vote', `/api/lobbies/${lobby.code}/vote`, { optionId });
    if (!succeeded) {
      setOptimisticVote((current) => (
        current?.key === votingKey && current.optionId === optionId ? null : current
      ));
    }
  }, [lobby, runAction, votingKey]);

  const updateSettings = useCallback(async (nextDeckId?: DeckDefinition['id'], nextRoundCount?: RoundCount) => {
    if (!lobby) return;

    const deckId = nextDeckId ?? lobby.config.deckId;
    const roundCount = nextRoundCount ?? lobby.config.roundCount;
    await runAction('settings', `/api/lobbies/${lobby.code}/settings`, {
      deckId,
      roundCount: String(roundCount)
    });
  }, [lobby, runAction]);

  if (loading) return null;

  if (!lobby) {
    return (
      <main className="app-shell">
        <div className="container narrow section-pad">
          <Surface>
            <div className="panel stack-md">
              <h1 className="section-title">Lobby not found</h1>
              <p className="muted">{error ?? 'That room code does not exist on the server.'}</p>
              <div className="actions">
                <a className="button button-primary" href="/">Go home</a>
                <button className="button button-secondary" onClick={() => void refresh()}>Retry</button>
              </div>
            </div>
          </Surface>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <div className="container section-pad stack-lg">
        <div className="topbar">
          <div className="stack-inline wrap gap-sm">
            <span className="badge">Room {lobby.code}</span>
            {me ? <span className="pill">You: {me.name}</span> : <span className="pill">Read-only view</span>}
            {isHost ? <span className="pill">host controls</span> : null}
          </div>
          <a className="button button-secondary" href="/">Home</a>
        </div>

        {status ? <p className="status-error">{status}</p> : null}
        {error && lobby ? <p className="muted">Refresh issue: {error}</p> : null}

        {!lobby.game ? (
          screen === 'decks' ? (
            <Surface>
              <div className="panel stack-lg" data-testid="deck-browser">
                <div className="space-between wrap gap-sm">
                  <div className="stack-sm">
                    <p className="eyebrow">Deck library</p>
                    <h2 className="section-title">Choose the room&apos;s next flavor of chaos</h2>
                    <p className="muted">
                      {isHost
                        ? 'Pick a deck here, then head back to the lobby to start the game.'
                        : 'Only the host can change decks, but everyone can preview what is selected.'}
                    </p>
                  </div>
                  <a className="button button-secondary" href={lobbyHref}>Back to lobby</a>
                </div>

                <div className="deck-browser-current">
                  <img
                    className="deck-browser-current-art"
                    src={selectedDeck.imagePath}
                    alt={selectedDeck.name}
                    data-testid="selected-deck-art"
                  />
                  <div className="stack-sm">
                    <p className="eyebrow">Currently selected</p>
                    <h3 className="deck-title">{selectedDeck.name}</h3>
                    <div className="pill-row">
                      <DeckTypePill archetype={selectedDeck.archetype} />
                      <span className="pill">{selectedRoundCount} rounds</span>
                      {selectedDeck.isAdult ? <span className="pill">Adult deck</span> : null}
                    </div>
                  </div>
                </div>

                <div className="deck-browser-grid">
                  {DECKS.map((deck) => (
                    <DeckCard
                      key={deck.id}
                      deck={deck}
                      active={lobby.config.deckId === deck.id}
                      disabled={!isHost || busyAction === 'settings'}
                      onClick={
                        isHost && busyAction !== 'settings'
                          ? () => void updateSettings(deck.id)
                          : undefined
                      }
                    />
                  ))}
                </div>
              </div>
            </Surface>
          ) : (
            <div className="grid lobby-grid">
              <Surface>
                <div className="panel stack-lg">
                  <div className="stack-md">
                    <p className="eyebrow">Players</p>
                    <div className="stack-sm">
                      {lobby.players.map((player) => (
                        <div key={player.id} className="list-row">
                          <span>{player.name}</span>
                          <div className="stack-inline">
                            {player.id === playerId ? <span className="pill">you</span> : null}
                            {player.isHost ? <span className="pill">host</span> : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="stack-md">
                    <div className="space-between wrap gap-sm">
                      <p className="eyebrow">Rounds</p>
                      <span className="muted">Hosts lock the match length here.</span>
                    </div>
                    <div className="round-count-row" role="group" aria-label="Choose round count">
                      {ROUND_COUNT_OPTIONS.map((count) => {
                        const active = lobby.config.roundCount === count;
                        return (
                          <button
                            key={count}
                            type="button"
                            className={`round-count-button ${active ? 'round-count-button-active' : ''}`}
                            data-testid={`round-count-${count}`}
                            disabled={!isHost || busyAction === 'settings'}
                            onClick={() => void updateSettings(undefined, count)}
                          >
                            {count} rounds
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="stack-sm">
                    <p className="eyebrow">Start game</p>
                    <button
                      className="button button-primary lobby-start-button"
                      data-testid="start-game"
                      disabled={!isHost || lobby.players.length < 3 || busyAction === 'start' || busyAction === 'settings'}
                      onClick={() => void runAction('start', `/api/lobbies/${lobby.code}/start`)}
                    >
                      Start game
                    </button>
                    {!me ? (
                      <p className="muted">This browser has not joined the room yet. Use the join screen with this code to participate.</p>
                    ) : (
                      <p className="muted">Start once at least three players are in and the deck feels right.</p>
                    )}
                  </div>
                </div>
              </Surface>

              <Surface>
                <div className="panel stack-lg" data-testid="deck-setup">
                  <div className="space-between wrap gap-sm">
                    <div className="stack-sm">
                      <p className="eyebrow">Deck preview</p>
                    </div>
                  </div>
                  <div className="deck-preview-card">
                    <DeckCard
                      deck={selectedDeck}
                      active
                      imageTestId="selected-deck-art"
                      footer={
                        <div className="pill-row">
                          <span className="pill">{selectedRoundCount} rounds</span>
                        </div>
                      }
                    />
                  </div>
                  <a
                    className="button button-secondary deck-preview-cta"
                    href={deckBrowserHref}
                    data-testid="change-deck"
                  >
                    Change deck
                  </a>
                </div>
              </Surface>
            </div>
          )
        ) : currentRound ? (
          <div className="grid game-grid">
            <Surface>
              <div className="panel stack-md">
                <div className="space-between wrap gap-sm">
                  <div>
                    <p className="eyebrow">Round {lobby.game.roundIndex + 1} / {lobby.game.roundCount}</p>
                    <h2>{roundTitle(currentRound)}</h2>
                  </div>
                  <span className="pill">{currentRound.phase}</span>
                </div>
                <div className="pill-row">
                  <span className="pill">{deckFor(lobby.game.deckId).name}</span>
                  <span className="pill">{lobby.game.roundCount} rounds</span>
                </div>
                <p className="prompt-category">{currentRound.prompt.category}</p>
                <p className="prompt-copy">{currentRound.prompt.text}</p>
                <p className="muted">{currentRound.prompt.votePrompt}</p>
              </div>
            </Surface>

            <Surface>
              <div className="panel stack-md">
                <p className="eyebrow">Live scores</p>
                <div className="stack-sm">
                  {sortedScores.map((player, index) => (
                    <div className="list-row" key={player.id}>
                      <span>#{index + 1} {player.name}</span>
                      <strong>{lobby.game?.scores[player.id] ?? 0}</strong>
                    </div>
                  ))}
                </div>
                <button
                  className="button button-secondary"
                  disabled={!isHost || busyAction === 'reset'}
                  onClick={() => void runAction('reset', `/api/lobbies/${lobby.code}/reset`)}
                >
                  Reset lobby
                </button>
              </div>
            </Surface>

            {currentRound.phase === 'submission' ? (
              <Surface>
                <div className="panel stack-md">
                  <p className="eyebrow">Submission phase</p>
                  {me ? (
                    <div className="submission-card stack-sm">
                      <div className="space-between wrap gap-sm">
                        <strong>{me.name}</strong>
                        <span className="pill">{hasSubmittedAnswer ? 'submitted' : draft.trim() ? 'draft ready' : 'waiting'}</span>
                      </div>
                      {hasSubmittedAnswer ? (
                        <>
                          <p className="muted">Your answer is locked in.</p>
                          <div className="muted-card">{effectiveSubmittedText}</div>
                        </>
                      ) : (
                        <>
                          <textarea
                            rows={3}
                            value={draft}
                            onChange={(event) => setDraft(event.target.value)}
                            placeholder={currentRound.archetype === 'bluff_trivia' ? 'Enter a convincing fake answer' : 'Enter your funniest answer'}
                          />
                          <button
                            className="button button-secondary"
                            disabled={busyAction === 'submit'}
                            onClick={() => void submitCurrentAnswer()}
                          >
                            Submit my answer
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <p className="muted">Join this lobby on this browser to submit an answer.</p>
                  )}
                  <div className="stack-sm">
                    {lobby.game.players.map((player) => {
                      const submitted = Boolean(currentRound.submissions.find((submission) => submission.playerId === player.id)?.text.trim());
                      return (
                        <div key={player.id} className="list-row">
                          <span>{player.name}</span>
                          <span className="pill">{submitted ? 'submitted' : 'waiting'}</span>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    className="button button-primary"
                    disabled={!isHost || !allSubmissionsComplete(currentRound) || busyAction === 'open-voting'}
                    onClick={() => void runAction('open-voting', `/api/lobbies/${lobby.code}/open-voting`)}
                  >
                    Lock answers and open voting
                  </button>
                </div>
              </Surface>
            ) : null}

            {currentRound.phase === 'voting' ? (
              <Surface>
                <div className="panel stack-md">
                  <p className="eyebrow">Voting phase</p>
                  {me ? (
                    <div className="submission-card stack-sm">
                      <div className="space-between wrap gap-sm">
                        <strong>{me.name}</strong>
                        <span className="pill">{effectiveVoteOptionId ? 'voted' : 'choose one'}</span>
                      </div>
                      {effectiveVoteOptionId ? <p className="muted">Your vote is locked in.</p> : null}
                      <div className="stack-xs">
                        {currentRound.options.map((option) => {
                          const disabled = Boolean(option.ownerPlayerId === me.id || effectiveVoteOptionId || busyAction === 'vote');
                          return (
                            <button
                              key={option.id}
                              className={`vote-option ${effectiveVoteOptionId === option.id ? 'vote-option-active' : ''}`}
                              onClick={() => void submitVoteChoice(option.id)}
                              disabled={disabled}
                            >
                              {option.text}
                              {option.ownerPlayerId === me.id ? <span className="vote-tag">your answer</span> : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="muted">Join this lobby on this browser to vote.</p>
                  )}
                  <div className="stack-sm">
                    {lobby.game.players.map((player) => (
                      <div key={player.id} className="list-row">
                        <span>{player.name}</span>
                        <span className="pill">{currentRound.votes[player.id] ? 'voted' : 'waiting'}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    className="button button-primary"
                    disabled={!isHost || !allVotesComplete(currentRound, lobby.game.players) || busyAction === 'reveal'}
                    onClick={() => void runAction('reveal', `/api/lobbies/${lobby.code}/reveal`)}
                  >
                    Reveal round results
                  </button>
                </div>
              </Surface>
            ) : null}

            {currentRound.phase === 'reveal' ? (
              <Surface>
                <div className="panel stack-md">
                  <p className="eyebrow">Reveal</p>
                  <div className="stack-sm">
                    {currentRound.archetype === 'bluff_trivia' ? (
                      <p className="reveal-banner">Truth: {currentRound.prompt.canonicalAnswer}</p>
                    ) : (
                      <p className="reveal-banner">The room has spoken.</p>
                    )}
                    {currentRound.summary.map((line) => (
                      <div key={line} className="list-row muted-card">{line}</div>
                    ))}
                  </div>
                  <div className="stack-sm">
                    {scoreRows(lobby.game.players, lobby.game.scores).map((player, index) => (
                      <div className="list-row" key={player.id}>
                        <span>#{index + 1} {player.name}</span>
                        <div className="stack-inline">
                          <span className="delta">+{currentRound.scoreDelta[player.id] ?? 0}</span>
                          <strong>{lobby.game?.scores[player.id] ?? 0}</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                  {lobby.game.phase === 'finished' ? (
                    <div className="actions">
                      <span className="pill">Match complete</span>
                      <button
                        className="button button-primary"
                        disabled={!isHost || busyAction === 'reset'}
                        onClick={() => void runAction('reset', `/api/lobbies/${lobby.code}/reset`)}
                      >
                        Play again
                      </button>
                    </div>
                  ) : (
                    <button
                      className="button button-primary"
                      disabled={!isHost || busyAction === 'next-round'}
                      onClick={() => void runAction('next-round', `/api/lobbies/${lobby.code}/next-round`)}
                    >
                      Next round
                    </button>
                  )}
                </div>
              </Surface>
            ) : null}
          </div>
        ) : null}
      </div>
    </main>
  );
}
