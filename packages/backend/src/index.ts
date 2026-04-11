import {
  attachRound,
  castVote,
  createGameSession,
  createRound,
  getCurrentRound,
  resolveRound,
  submitAnswer,
  updateRound
} from '@decoy/game-engine';
import type {
  AdvanceRoundInput,
  CastVoteInput,
  CreateLobbyInput,
  GameSession,
  JoinLobbyInput,
  Lobby,
  LobbyCode,
  LobbySnapshot,
  PlayerProfile,
  RoundArchetype,
  StartGameInput,
  SubmitAnswerInput
} from '@decoy/types';

const lobbies = new Map<string, Lobby>();
const lobbyCodes = new Map<LobbyCode, string>();
const sessions = new Map<string, GameSession>();

const now = () => new Date().toISOString();
const makeId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
const randomCode = () => Math.random().toString(36).slice(2, 6).toUpperCase();

function makeLobbyCode(): LobbyCode {
  let code = randomCode();
  while (lobbyCodes.has(code)) code = randomCode();
  return code;
}

function createPlayer(displayName: string, isHost = false): PlayerProfile {
  return {
    id: makeId('player'),
    displayName: displayName.trim(),
    joinedAt: now(),
    isHost,
    isConnected: true
  };
}

function requireLobby(lobbyId: string): Lobby {
  const lobby = lobbies.get(lobbyId);
  if (!lobby) throw new Error('Lobby not found.');
  return lobby;
}

function requireSession(lobby: Lobby): GameSession {
  if (!lobby.gameSessionId) throw new Error('Game session not started.');
  const session = sessions.get(lobby.gameSessionId);
  if (!session) throw new Error('Game session missing.');
  return session;
}

function updateLobby(lobby: Lobby): Lobby {
  const updated = { ...lobby, updatedAt: now() };
  lobbies.set(updated.id, updated);
  return updated;
}

export function createLobby(input: CreateLobbyInput): LobbySnapshot {
  const host = createPlayer(input.hostName, true);
  const timestamp = now();
  const lobby: Lobby = {
    id: makeId('lobby'),
    code: makeLobbyCode(),
    hostPlayerId: host.id,
    players: [host],
    createdAt: timestamp,
    updatedAt: timestamp
  };
  lobbies.set(lobby.id, lobby);
  lobbyCodes.set(lobby.code, lobby.id);
  return { lobby };
}

export function joinLobby(input: JoinLobbyInput): LobbySnapshot {
  const lobbyId = lobbyCodes.get(input.code.toUpperCase());
  if (!lobbyId) throw new Error('Lobby code not found.');
  const lobby = requireLobby(lobbyId);
  const existing = lobby.players.find((player) => player.displayName.toLowerCase() === input.displayName.trim().toLowerCase());
  if (existing) {
    return getLobbySnapshot(lobby.id);
  }
  const updated = updateLobby({
    ...lobby,
    players: [...lobby.players, createPlayer(input.displayName)]
  });
  return getLobbySnapshot(updated.id);
}

export function startGame(input: StartGameInput): LobbySnapshot {
  const lobby = requireLobby(input.lobbyId);
  const archetype: RoundArchetype = input.archetype ?? 'bluff_trivia';
  const session = attachRound(
    createGameSession({
      lobbyId: lobby.id,
      hostPlayerId: lobby.hostPlayerId,
      players: lobby.players
    }),
    createRound({ archetype, roundNumber: 1, players: lobby.players })
  );
  sessions.set(session.id, session);
  updateLobby({ ...lobby, gameSessionId: session.id });
  return getLobbySnapshot(lobby.id);
}

export function submitPlayerAnswer(input: SubmitAnswerInput): LobbySnapshot {
  const lobby = requireLobby(input.lobbyId);
  const session = requireSession(lobby);
  const round = getCurrentRound(session);
  if (!round || round.id !== input.roundId) throw new Error('Round not found.');
  const updatedRound = submitAnswer(round, { playerId: input.playerId, text: input.text });
  const updatedSession = updateRound(session, updatedRound);
  sessions.set(updatedSession.id, updatedSession);
  return getLobbySnapshot(lobby.id);
}

export function castPlayerVote(input: CastVoteInput): LobbySnapshot {
  const lobby = requireLobby(input.lobbyId);
  const session = requireSession(lobby);
  const round = getCurrentRound(session);
  if (!round || round.id !== input.roundId) throw new Error('Round not found.');
  let updatedRound = castVote(round, { playerId: input.playerId, submissionId: input.submissionId });
  let updatedSession = updateRound(session, updatedRound);

  const playerCount = lobby.players.length;
  const neededVotes = Math.max(playerCount, 1);
  if (updatedRound.votes.length >= neededVotes) {
    const resolved = resolveRound(updatedSession, updatedRound);
    updatedRound = resolved.round;
    updatedSession = resolved.session;
  }

  sessions.set(updatedSession.id, updatedSession);
  return getLobbySnapshot(lobby.id);
}

export function advanceRound(input: AdvanceRoundInput & { archetype?: RoundArchetype }): LobbySnapshot {
  const lobby = requireLobby(input.lobbyId);
  const session = requireSession(lobby);
  const nextRound = createRound({
    archetype: input.archetype ?? nextArchetype(getCurrentRound(session)?.archetype),
    roundNumber: session.rounds.length + 1,
    players: lobby.players
  });
  const updatedSession = attachRound(session, nextRound);
  sessions.set(updatedSession.id, updatedSession);
  return getLobbySnapshot(lobby.id);
}

function nextArchetype(current?: RoundArchetype): RoundArchetype {
  return current === 'bluff_trivia' ? 'opinion_vote' : 'bluff_trivia';
}

export function getLobbySnapshot(lobbyId: string): LobbySnapshot {
  const lobby = requireLobby(lobbyId);
  const session = lobby.gameSessionId ? sessions.get(lobby.gameSessionId) : undefined;
  return {
    lobby,
    session,
    currentRound: getCurrentRound(session)
  };
}

export function findLobbyByCode(code: string): LobbySnapshot {
  const lobbyId = lobbyCodes.get(code.toUpperCase());
  if (!lobbyId) throw new Error('Lobby code not found.');
  return getLobbySnapshot(lobbyId);
}

export function resetStore(): void {
  lobbies.clear();
  lobbyCodes.clear();
  sessions.clear();
}
