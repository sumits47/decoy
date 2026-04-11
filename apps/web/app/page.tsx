'use client';

import type { LobbySnapshot, PlayerProfile, RoundState } from '@decoy/types';
import { useMemo, useState } from 'react';

type Archetype = 'bluff_trivia' | 'opinion_vote';

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Request failed');
  return data as T;
}

function RoundPanel({
  snapshot,
  activePlayer,
  onRefresh
}: {
  snapshot: LobbySnapshot;
  activePlayer?: PlayerProfile;
  onRefresh: (next?: LobbySnapshot) => Promise<void>;
}) {
  const round = snapshot.currentRound;
  const [answer, setAnswer] = useState('');
  const voteableSubmissions = useMemo(() => {
    if (!round || !activePlayer) return [];
    const picks = [...round.submissions];
    if (round.archetype === 'bluff_trivia') picks.push(round.truthSubmission);
    return picks.filter((submission) => submission.playerId !== activePlayer.id);
  }, [round, activePlayer]);

  if (!round) return <p>No round yet.</p>;

  const hasSubmitted = !!activePlayer && round.submissions.some((submission) => submission.playerId === activePlayer.id);
  const hasVoted = !!activePlayer && round.votes.some((vote) => vote.playerId === activePlayer.id);

  return (
    <div className="card feature" style={{ display: 'grid', gap: 12 }}>
      <div>
        <div className="badge">Round {round.roundNumber}</div>
        <h3>{round.prompt.title}</h3>
        <p>{round.prompt.body}</p>
        <p>
          <strong>Mode:</strong> {round.archetype} · <strong>Phase:</strong> {round.phase}
        </p>
      </div>

      {activePlayer ? <p><strong>Active player:</strong> {activePlayer.displayName}</p> : <p>Pick a player to act as.</p>}

      {round.phase === 'submit' && activePlayer && (
        <div style={{ display: 'grid', gap: 8 }}>
          <input value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Type an answer or decoy" />
          <button
            className="button button-primary"
            disabled={hasSubmitted || !answer.trim()}
            onClick={async () => {
              const next = await api<LobbySnapshot>(`/api/lobbies/${snapshot.lobby.id}/submit`, {
                method: 'POST',
                body: JSON.stringify({ roundId: round.id, playerId: activePlayer.id, text: answer })
              });
              setAnswer('');
              await onRefresh(next);
            }}
          >
            {hasSubmitted ? 'Submitted' : 'Submit'}
          </button>
        </div>
      )}

      {round.phase === 'vote' && activePlayer && (
        <div style={{ display: 'grid', gap: 8 }}>
          {voteableSubmissions.map((submission) => (
            <button
              key={submission.id}
              className="button button-secondary"
              disabled={hasVoted}
              onClick={async () => {
                const next = await api<LobbySnapshot>(`/api/lobbies/${snapshot.lobby.id}/vote`, {
                  method: 'POST',
                  body: JSON.stringify({ roundId: round.id, playerId: activePlayer.id, submissionId: submission.id })
                });
                await onRefresh(next);
              }}
            >
              Vote: {submission.text}
            </button>
          ))}
        </div>
      )}

      {round.phase === 'complete' && (
        <>
          <div>
            <strong>Reveals</strong>
            <ul>
              {round.archetype === 'bluff_trivia' ? <li>Truth: {round.truthSubmission.text}</li> : null}
              {round.submissions.map((submission) => (
                <li key={submission.id}>
                  {submission.text} — {snapshot.lobby.players.find((player) => player.id === submission.playerId)?.displayName}
                </li>
              ))}
            </ul>
          </div>
          <button
            className="button button-primary"
            onClick={async () => {
              const next = await api<LobbySnapshot>(`/api/lobbies/${snapshot.lobby.id}/advance`, { method: 'POST', body: '{}' });
              await onRefresh(next);
            }}
          >
            Next round
          </button>
        </>
      )}
    </div>
  );
}

export default function HomePage() {
  const [snapshot, setSnapshot] = useState<LobbySnapshot>();
  const [hostName, setHostName] = useState('Sumit');
  const [joinName, setJoinName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [activePlayerId, setActivePlayerId] = useState<string>();
  const [archetype, setArchetype] = useState<Archetype>('bluff_trivia');
  const [error, setError] = useState<string>();

  const players = snapshot?.lobby.players ?? [];
  const activePlayer = players.find((player) => player.id === activePlayerId) ?? players[0];

  async function refresh(next?: LobbySnapshot) {
    if (next) {
      setSnapshot(next);
      setActivePlayerId((current) => current ?? next.lobby.players[0]?.id);
      return;
    }
    if (!snapshot) return;
    const latest = await api<LobbySnapshot>(`/api/lobbies/${snapshot.lobby.id}`);
    setSnapshot(latest);
  }

  async function run<T>(fn: () => Promise<T>) {
    try {
      setError(undefined);
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }

  return (
    <main>
      <section className="hero">
        <div className="container grid hero-grid">
          <div>
            <span className="badge">Decoy · in-memory prototype</span>
            <h1 className="h1">Lie well. Guess better.</h1>
            <p className="lead">Lean backend/domain foundations for local end-to-end play. Create a lobby, add a few fake players, start a round, submit, vote, reveal, repeat.</p>
            {error ? <p style={{ color: '#ffb4b4' }}>{error}</p> : null}
            <div className="actions" style={{ alignItems: 'stretch', flexDirection: 'column' }}>
              <input value={hostName} onChange={(event) => setHostName(event.target.value)} placeholder="Host name" />
              <button
                className="button button-primary"
                onClick={() =>
                  run(async () => {
                    const next = await api<LobbySnapshot>('/api/lobbies', {
                      method: 'POST',
                      body: JSON.stringify({ hostName })
                    });
                    setJoinCode(next.lobby.code);
                    await refresh(next);
                  })
                }
              >
                Create lobby
              </button>
            </div>
          </div>

          <div className="card hero-card" style={{ display: 'grid', gap: 12 }}>
            <div>
              <strong>Join / reload</strong>
              <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                <input value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} placeholder="Lobby code" />
                <input value={joinName} onChange={(event) => setJoinName(event.target.value)} placeholder="Player name" />
                <button
                  className="button button-secondary"
                  onClick={() =>
                    run(async () => {
                      const next = await api<LobbySnapshot>(`/api/lobbies/${snapshot?.lobby.id ?? 'code'}/join`, {
                        method: 'POST',
                        body: JSON.stringify({ code: joinCode, displayName: joinName })
                      });
                      setSnapshot(next);
                      setActivePlayerId((current) => current ?? next.lobby.players.at(-1)?.id);
                      setJoinName('');
                    })
                  }
                >
                  Join lobby
                </button>
                <button
                  className="button button-secondary"
                  onClick={() =>
                    run(async () => {
                      const next = await api<LobbySnapshot>(`/api/lobbies/code/${joinCode}`);
                      await refresh(next);
                    })
                  }
                >
                  Load by code
                </button>
              </div>
            </div>

            {snapshot ? (
              <div>
                <p><strong>Lobby:</strong> {snapshot.lobby.code}</p>
                <p><strong>Players:</strong> {snapshot.lobby.players.length}</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {players.map((player) => (
                    <button
                      key={player.id}
                      className="button button-secondary"
                      onClick={() => setActivePlayerId(player.id)}
                    >
                      {player.displayName}{player.id === activePlayer?.id ? ' ✓' : ''}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {snapshot ? (
        <section className="section">
          <div className="container grid feature-grid">
            <div className="card feature" style={{ display: 'grid', gap: 12 }}>
              <h2>Game controls</h2>
              <select value={archetype} onChange={(event) => setArchetype(event.target.value as Archetype)}>
                <option value="bluff_trivia">bluff_trivia</option>
                <option value="opinion_vote">opinion_vote</option>
              </select>
              {!snapshot.session ? (
                <button
                  className="button button-primary"
                  onClick={() =>
                    run(async () => {
                      const next = await api<LobbySnapshot>(`/api/lobbies/${snapshot.lobby.id}/start`, {
                        method: 'POST',
                        body: JSON.stringify({ archetype })
                      });
                      await refresh(next);
                    })
                  }
                >
                  Start game
                </button>
              ) : (
                <>
                  <p><strong>Status:</strong> {snapshot.session.status}</p>
                  <ul>
                    {snapshot.session.scoreboard.map((entry) => (
                      <li key={entry.playerId}>
                        {players.find((player) => player.id === entry.playerId)?.displayName}: {entry.score}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            <RoundPanel snapshot={snapshot} activePlayer={activePlayer} onRefresh={refresh} />
          </div>
        </section>
      ) : null}
    </main>
  );
}
