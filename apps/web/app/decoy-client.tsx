'use client';

import type { LobbySnapshot } from '@decoy/types';
import { useEffect, useState } from 'react';

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Request failed');
  return data as T;
}

export function LandingClient() {
  const [hostName, setHostName] = useState('Host');
  const [joinCode, setJoinCode] = useState('');

  return (
    <main className="section">
      <div className="container" style={{ display: 'grid', gap: 16 }}>
        <h1>Decoy</h1>
        <input value={hostName} onChange={(event) => setHostName(event.target.value)} placeholder="Host name" />
        <a className="button button-primary" href={`/create?host=${encodeURIComponent(hostName)}`}>Create lobby</a>
        <input value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} placeholder="Room code" />
        <a className="button button-secondary" href={`/join?code=${encodeURIComponent(joinCode)}`}>Join lobby</a>
      </div>
    </main>
  );
}

export function CreateLobbyClient({ hostName }: { hostName: string }) {
  const [snapshot, setSnapshot] = useState<LobbySnapshot>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    api<LobbySnapshot>('/api/lobbies', { method: 'POST', body: JSON.stringify({ hostName }) })
      .then(setSnapshot)
      .catch((err) => setError(err instanceof Error ? err.message : 'Unknown error'));
  }, [hostName]);

  if (error) return <main className="section"><div className="container">{error}</div></main>;
  if (!snapshot) return <main className="section"><div className="container">Creating lobby…</div></main>;

  return (
    <main className="section">
      <div className="container" style={{ display: 'grid', gap: 16 }}>
        <h1>Lobby created: {snapshot.lobby.code}</h1>
        <a className="button button-primary" href={`/lobby/${snapshot.lobby.code}`}>Open lobby</a>
      </div>
    </main>
  );
}

export function JoinLobbyClient({ initialCode }: { initialCode: string }) {
  const [code, setCode] = useState(initialCode.toUpperCase());
  const [name, setName] = useState('');
  const [status, setStatus] = useState<string>();

  return (
    <main className="section">
      <div className="container" style={{ display: 'grid', gap: 16 }}>
        <h1>Join lobby</h1>
        <input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="Room code" />
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" />
        <button
          className="button button-primary"
          onClick={async () => {
            try {
              const snapshot = await api<LobbySnapshot>(`/api/lobbies/code/${code}`);
              await api<LobbySnapshot>(`/api/lobbies/${snapshot.lobby.id}/join`, {
                method: 'POST',
                body: JSON.stringify({ code, displayName: name })
              });
              window.location.href = `/lobby/${code}`;
            } catch (err) {
              setStatus(err instanceof Error ? err.message : 'Unknown error');
            }
          }}
        >
          Join
        </button>
        {status ? <p>{status}</p> : null}
      </div>
    </main>
  );
}

export function LobbyClient({ code }: { code: string }) {
  const [snapshot, setSnapshot] = useState<LobbySnapshot>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    api<LobbySnapshot>(`/api/lobbies/code/${code}`)
      .then(setSnapshot)
      .catch((err) => setError(err instanceof Error ? err.message : 'Unknown error'));
  }, [code]);

  if (error) return <main className="section"><div className="container">{error}</div></main>;
  if (!snapshot) return <main className="section"><div className="container">Loading lobby…</div></main>;

  return (
    <main className="section">
      <div className="container" style={{ display: 'grid', gap: 16 }}>
        <h1>Lobby {snapshot.lobby.code}</h1>
        <ul>
          {snapshot.lobby.players.map((player) => <li key={player.id}>{player.displayName}</li>)}
        </ul>
        <a className="button button-primary" href="/">Back home</a>
      </div>
    </main>
  );
}
