'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  addPlayer,
  advanceToNextRound,
  allSubmissionsComplete,
  allVotesComplete,
  applyRoundScore,
  castVote,
  createLobby,
  getPromptDeck,
  lockSubmissions,
  scoreRound,
  startGame,
  submitAnswer
} from '@decoy/game-engine';
import type { LobbyState, Player, RoundState } from '@decoy/types';
import { Surface } from '@decoy/ui';

const STORAGE_KEY = 'decoy.local.lobbies.v1';

function loadLobbies(): Record<string, LobbyState> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, LobbyState>) : {};
  } catch {
    return {};
  }
}

function saveLobby(lobby: LobbyState) {
  const lobbies = loadLobbies();
  lobbies[lobby.code] = lobby;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lobbies));
}

function getLobby(code: string) {
  return loadLobbies()[code.toUpperCase()] ?? null;
}

function scoreRows(players: Player[], scores: Record<string, number>) {
  return [...players].sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0));
}

export function LandingClient() {
  const [hostName, setHostName] = useState('Sumit');
  const [joinCode, setJoinCode] = useState('');

  return (
    <main className="app-shell">
      <section className="hero hero-simple">
        <div className="container stack-lg">
          <div className="hero-copy stack-md">
            <span className="badge">Decoy · playable prototype</span>
            <h1 className="h1">Lie well. Guess better.</h1>
            <p className="lead">
              A local-first vertical slice for the full Decoy loop: create a lobby, add players, run one bluff/trivia round,
              run one opinion-vote round, reveal scores, then advance.
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
                <span className="pill">hot-seat multiplayer</span>
                <span className="pill">localStorage persistence</span>
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

  useEffect(() => {
    const lobby = createLobby(hostName || 'Host');
    saveLobby(lobby);
    setCreatedLobbyCode(lobby.code);
  }, [hostName]);

  if (!createdLobbyCode) return null;

  return (
    <main className="app-shell">
      <div className="container narrow stack-lg section-pad">
        <Surface>
          <div className="panel stack-md">
            <p className="eyebrow">Lobby created</p>
            <h1 className="section-title">Room code {createdLobbyCode}</h1>
            <p className="muted">Pass the code around, or just keep adding players on the next screen for a hot-seat demo.</p>
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
  const [status, setStatus] = useState<string | null>(null);

  const join = () => {
    const lobby = getLobby(code);
    if (!lobby) {
      setStatus('No lobby found for that code.');
      return;
    }

    const next = addPlayer(lobby, name || `Player ${lobby.players.length + 1}`);
    saveLobby(next);
    window.location.href = `/lobby/${next.code}`;
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
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Riya" />
            </label>
            {status ? <p className="status-error">{status}</p> : null}
            <div className="actions">
              <button className="button button-primary" onClick={join}>Join lobby</button>
              <a className="button button-secondary" href="/">Back home</a>
            </div>
          </div>
        </Surface>
      </div>
    </main>
  );
}

function roundTitle(round: RoundState) {
  return round.archetype === 'bluff_trivia' ? 'Bluff trivia' : 'Opinion vote';
}

export function LobbyClient({ code }: { code: string }) {
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setLobby(getLobby(code));
  }, [code, refreshKey]);

  const persistLobby = (nextLobby: LobbyState) => {
    saveLobby(nextLobby);
    setLobby(nextLobby);
  };

  const currentRound = lobby?.game?.rounds[lobby.game.roundIndex];
  const sortedScores = useMemo(() => {
    if (!lobby?.game) return [];
    return scoreRows(lobby.game.players, lobby.game.scores);
  }, [lobby]);

  if (!lobby) {
    return (
      <main className="app-shell">
        <div className="container narrow section-pad">
          <Surface>
            <div className="panel stack-md">
              <h1 className="section-title">Lobby not found</h1>
              <p className="muted">That room code isn’t in local storage on this device.</p>
              <div className="actions">
                <a className="button button-primary" href="/">Go home</a>
                <button className="button button-secondary" onClick={() => setRefreshKey((value) => value + 1)}>Retry</button>
              </div>
            </div>
          </Surface>
        </div>
      </main>
    );
  }

  const addLocalPlayer = () => {
    const next = addPlayer(lobby, newPlayerName || `Player ${lobby.players.length + 1}`);
    persistLobby(next);
    setNewPlayerName('');
  };

  const launchGame = () => {
    if (lobby.players.length < 3) return;
    persistLobby(startGame(lobby));
  };

  const updateDraft = (playerId: string, value: string) => {
    setDrafts((current) => ({ ...current, [playerId]: value }));
  };

  const submitForPlayer = (playerId: string) => {
    const game = lobby.game;
    if (!game || !currentRound) return;
    const nextRound = submitAnswer(currentRound, playerId, drafts[playerId] ?? '');
    const nextGame = {
      ...game,
      rounds: game.rounds.map((round, index) => (index === game.roundIndex ? nextRound : round))
    };
    persistLobby({ ...lobby, game: nextGame });
  };

  const moveToVoting = () => {
    const game = lobby.game;
    if (!game || !currentRound || !allSubmissionsComplete(currentRound)) return;
    const nextRound = lockSubmissions(currentRound);
    const nextGame = {
      ...game,
      rounds: game.rounds.map((round, index) => (index === game.roundIndex ? nextRound : round))
    };
    persistLobby({ ...lobby, game: nextGame });
  };

  const voteForPlayer = (playerId: string, optionId: string) => {
    const game = lobby.game;
    if (!game || !currentRound) return;
    const nextRound = castVote(currentRound, playerId, optionId);
    const nextGame = {
      ...game,
      rounds: game.rounds.map((round, index) => (index === game.roundIndex ? nextRound : round))
    };
    persistLobby({ ...lobby, game: nextGame });
  };

  const revealScores = () => {
    if (!lobby.game || !currentRound || !allVotesComplete(currentRound, lobby.game.players)) return;
    const scoredRound = scoreRound(currentRound, lobby.game.players);
    const nextGame = applyRoundScore(lobby.game, scoredRound);
    persistLobby({ ...lobby, game: nextGame });
  };

  const nextRound = () => {
    if (!lobby.game) return;
    persistLobby({ ...lobby, game: advanceToNextRound(lobby.game) });
  };

  const resetDemo = () => {
    persistLobby({ ...lobby, game: undefined });
    setDrafts({});
  };

  return (
    <main className="app-shell">
      <div className="container section-pad stack-lg">
        <div className="topbar">
          <div>
            <span className="badge">Room {lobby.code}</span>
            <h1 className="section-title">Decoy lobby</h1>
          </div>
          <a className="button button-secondary" href="/">Home</a>
        </div>

        {!lobby.game ? (
          <div className="grid lobby-grid">
            <Surface>
              <div className="panel stack-md">
                <p className="eyebrow">Players</p>
                <div className="stack-sm">
                  {lobby.players.map((player) => (
                    <div key={player.id} className="list-row">
                      <span>{player.name}</span>
                      {player.isHost ? <span className="pill">host</span> : null}
                    </div>
                  ))}
                </div>
                <div className="stack-sm inline-form">
                  <input value={newPlayerName} onChange={(event) => setNewPlayerName(event.target.value)} placeholder="Add player" />
                  <button className="button button-secondary" onClick={addLocalPlayer}>Add player</button>
                </div>
                <p className="muted">Need at least 3 players. This prototype works great in hot-seat mode on one device.</p>
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
                <button className="button button-primary" disabled={lobby.players.length < 3} onClick={launchGame}>
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
                <button className="button button-secondary" onClick={resetDemo}>Reset lobby</button>
              </div>
            </Surface>

            {currentRound.phase === 'submission' ? (
              <Surface>
                <div className="panel stack-md">
                  <p className="eyebrow">Submission phase</p>
                  <div className="stack-md">
                    {lobby.game.players.map((player) => {
                      const existing = currentRound.submissions.find((submission) => submission.playerId === player.id)?.text ?? '';
                      return (
                        <div key={player.id} className="submission-card stack-sm">
                          <div className="space-between wrap gap-sm">
                            <strong>{player.name}</strong>
                            <span className="pill">{existing ? 'locked in' : 'waiting'}</span>
                          </div>
                          <textarea
                            rows={3}
                            value={drafts[player.id] ?? existing}
                            onChange={(event) => updateDraft(player.id, event.target.value)}
                            placeholder={currentRound.archetype === 'bluff_trivia' ? 'Enter a convincing fake answer' : 'Enter your funniest answer'}
                          />
                          <button className="button button-secondary" onClick={() => submitForPlayer(player.id)}>Submit for {player.name}</button>
                        </div>
                      );
                    })}
                  </div>
                  <button className="button button-primary" disabled={!allSubmissionsComplete(currentRound)} onClick={moveToVoting}>
                    Lock answers and open voting
                  </button>
                </div>
              </Surface>
            ) : null}

            {currentRound.phase === 'voting' ? (
              <Surface>
                <div className="panel stack-md">
                  <p className="eyebrow">Voting phase</p>
                  <div className="stack-md">
                    {lobby.game.players.map((player) => {
                      const ownOptionId = currentRound.archetype === 'opinion_vote'
                        ? currentRound.options.find((option) => option.ownerPlayerId === player.id)?.id
                        : null;

                      return (
                        <div key={player.id} className="submission-card stack-sm">
                          <div className="space-between wrap gap-sm">
                            <strong>{player.name}</strong>
                            <span className="pill">{currentRound.votes[player.id] ? 'voted' : 'choose one'}</span>
                          </div>
                          <div className="stack-xs">
                            {currentRound.options.map((option) => {
                              const disabled = currentRound.archetype === 'opinion_vote' && ownOptionId === option.id;
                              return (
                                <button
                                  key={option.id}
                                  className={`vote-option ${currentRound.votes[player.id] === option.id ? 'vote-option-active' : ''}`}
                                  onClick={() => voteForPlayer(player.id, option.id)}
                                  disabled={disabled}
                                >
                                  {option.text}
                                  {disabled ? <span className="vote-tag">your answer</span> : null}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button className="button button-primary" disabled={!allVotesComplete(currentRound, lobby.game.players)} onClick={revealScores}>
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
                      <button className="button button-primary" onClick={resetDemo}>Play again</button>
                    </div>
                  ) : (
                    <button className="button button-primary" onClick={nextRound}>Next round</button>
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
