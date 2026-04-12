'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { allSubmissionsComplete, allVotesComplete, getPromptDeck } from '@decoy/game-engine';
import type { LobbyMembership, LobbyState, Player, RoundState } from '@decoy/types';
import { Surface } from '@decoy/ui';

const PLAYER_KEY = 'decoy.player.identity.v2';
const POLL_MS = 2000;

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

  const refresh = useCallback(async () => {
    try {
      const data = await api<{ lobby: LobbyState }>(`/api/lobbies/${code}`);
      setLobby(data.lobby);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to load lobby.');
      setLobby(null);
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    void refresh();
    const intervalId = window.setInterval(() => {
      void refresh();
    }, POLL_MS);
    return () => window.clearInterval(intervalId);
  }, [refresh]);

  return { lobby, loading, error, refresh, setLobby };
}

function roundTitle(round: RoundState) {
  return round.archetype === 'bluff_trivia' ? 'Bluff trivia' : 'Opinion vote';
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
              A server-authoritative vertical slice for the Decoy loop: create a lobby, join from separate devices,
              run a bluff round, run an opinion round, reveal scores, then advance.
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

          <Surface>
            <div className="panel stack-md">
              <p className="eyebrow">Included in this build</p>
              <div className="pill-row">
                {getPromptDeck().map((prompt) => (
                  <span key={prompt.id} className="pill">{prompt.archetype}</span>
                ))}
                <span className="pill">multi-device lobby</span>
                <span className="pill">server snapshot polling</span>
              </div>
            </div>
          </Surface>
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

  if (!createdLobbyCode) return null;

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

export function LobbyClient({ code }: { code: string }) {
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
          <div className="stack-sm">
            <div className="stack-inline wrap gap-sm">
              <span className="badge">Room {lobby.code}</span>
              {me ? <span className="pill">You: {me.name}</span> : <span className="pill">Read-only view</span>}
              {isHost ? <span className="pill">host controls</span> : null}
            </div>
            <h1 className="section-title">Decoy lobby</h1>
          </div>
          <a className="button button-secondary" href="/">Home</a>
        </div>

        {status ? <p className="status-error">{status}</p> : null}
        {error && lobby ? <p className="muted">Refresh issue: {error}</p> : null}

        {!lobby.game ? (
          <div className="grid lobby-grid">
            <Surface>
              <div className="panel stack-md">
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
                {!me ? (
                  <p className="muted">This browser has not joined the room yet. Use the join screen with this code to participate.</p>
                ) : (
                  <p className="muted">Waiting for the host to start once at least 3 players are in.</p>
                )}
              </div>
            </Surface>

            <Surface>
              <div className="panel stack-md">
                <p className="eyebrow">Game flow</p>
                <ol className="steps">
                  <li>Bluff trivia round</li>
                  <li>Opinion vote round</li>
                  <li>Score reveal</li>
                  <li>Next round / finish</li>
                </ol>
                <button
                  className="button button-primary"
                  disabled={!isHost || lobby.players.length < 3 || busyAction === 'start'}
                  onClick={() => void runAction('start', `/api/lobbies/${lobby.code}/start`)}
                >
                  Start game
                </button>
              </div>
            </Surface>
          </div>
        ) : currentRound ? (
          <div className="grid game-grid">
            <Surface>
              <div className="panel stack-md">
                <div className="space-between wrap gap-sm">
                  <div>
                    <p className="eyebrow">Round {lobby.game.roundIndex + 1} / {getPromptDeck().length}</p>
                    <h2>{roundTitle(currentRound)}</h2>
                  </div>
                  <span className="pill">{currentRound.phase}</span>
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
