import {
  addPlayer,
  advanceToNextRound,
  allSubmissionsComplete,
  allVotesComplete,
  applyRoundScore,
  castVote as castVoteOnRound,
  createLobby as createLobbyState,
  lockSubmissions,
  scoreRound,
  startGame as startGameState,
  submitAnswer as submitRoundAnswer
} from '@decoy/game-engine';
import type { LobbyCode, LobbyState, Player, PlayerId, RoundState } from '@decoy/types';

class LobbyError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type LobbyStore = Map<LobbyCode, LobbyState>;

const globalStore = globalThis as typeof globalThis & { __decoyLobbyStore__?: LobbyStore };

function getStore(): LobbyStore {
  if (!globalStore.__decoyLobbyStore__) {
    globalStore.__decoyLobbyStore__ = new Map();
  }
  return globalStore.__decoyLobbyStore__;
}

function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function requireLobby(code: string) {
  const lobby = getStore().get(normalizeCode(code));
  if (!lobby) throw new LobbyError(404, 'Lobby not found.');
  return lobby;
}

function saveLobby(lobby: LobbyState) {
  getStore().set(normalizeCode(lobby.code), clone(lobby));
  return clone(lobby);
}

function requirePlayer(lobby: LobbyState, playerId: PlayerId) {
  const player = lobby.players.find((candidate) => candidate.id === playerId);
  if (!player) throw new LobbyError(403, 'Player not in this lobby.');
  return player;
}

function requireHost(lobby: LobbyState, playerId: PlayerId) {
  requirePlayer(lobby, playerId);
  if (lobby.hostPlayerId !== playerId) {
    throw new LobbyError(403, 'Only the host can do that.');
  }
}

function currentRound(lobby: LobbyState): RoundState {
  const round = lobby.game?.rounds[lobby.game.roundIndex];
  if (!round) throw new LobbyError(409, 'No active round.');
  return round;
}

function replaceCurrentRound(lobby: LobbyState, nextRound: RoundState): LobbyState {
  if (!lobby.game) throw new LobbyError(409, 'Game has not started.');

  return {
    ...lobby,
    game: {
      ...lobby.game,
      rounds: lobby.game.rounds.map((round, index) => (index === lobby.game!.roundIndex ? nextRound : round))
    }
  };
}

export function createLobbySession(hostName: string) {
  return saveLobby(createLobbyState(hostName));
}

export function createLobby(hostName: string) {
  return createLobbySession(hostName);
}

export function getLobbySnapshot(code: string) {
  return clone(requireLobby(code));
}

export function fetchSnapshot(code: string) {
  return getLobbySnapshot(code);
}

export function joinLobby(code: string, name: string) {
  const lobby = requireLobby(code);
  const nextLobby = addPlayer(lobby, name || `Player ${lobby.players.length + 1}`);
  if (nextLobby.players.length === lobby.players.length) {
    throw new LobbyError(400, 'Enter a player name.');
  }

  const player = nextLobby.players[nextLobby.players.length - 1] as Player | undefined;
  if (!player) {
    throw new LobbyError(500, 'Could not join lobby.');
  }

  saveLobby(nextLobby);
  return { lobby: clone(nextLobby), player };
}

export function startLobbyGame(code: string, actorPlayerId: PlayerId) {
  const lobby = requireLobby(code);
  requireHost(lobby, actorPlayerId);
  if (lobby.players.length < 3) throw new LobbyError(400, 'Need at least 3 players.');
  return saveLobby(startGameState(lobby));
}

export function startGame(code: string, actorPlayerId: PlayerId) {
  return startLobbyGame(code, actorPlayerId);
}

export function submitLobbyAnswer(code: string, actorPlayerId: PlayerId, text: string) {
  const lobby = requireLobby(code);
  requirePlayer(lobby, actorPlayerId);
  const round = currentRound(lobby);
  if (round.phase !== 'submission') throw new LobbyError(409, 'Submission phase is over.');

  const submitted = submitRoundAnswer(round, actorPlayerId, text);
  const nextRound = allSubmissionsComplete(submitted) ? lockSubmissions(submitted) : submitted;
  return saveLobby(replaceCurrentRound(lobby, nextRound));
}

export function submitAnswer(code: string, actorPlayerId: PlayerId, text: string) {
  return submitLobbyAnswer(code, actorPlayerId, text);
}

export function openLobbyVoting(code: string, actorPlayerId: PlayerId) {
  const lobby = requireLobby(code);
  requireHost(lobby, actorPlayerId);
  const round = currentRound(lobby);
  if (!allSubmissionsComplete(round)) throw new LobbyError(409, 'Waiting for all submissions.');
  return saveLobby(replaceCurrentRound(lobby, lockSubmissions(round)));
}

export function submitLobbyVote(code: string, actorPlayerId: PlayerId, optionId: string) {
  const lobby = requireLobby(code);
  requirePlayer(lobby, actorPlayerId);
  const round = currentRound(lobby);
  if (round.phase !== 'voting') throw new LobbyError(409, 'Voting is not open.');
  if (!round.options.some((option) => option.id === optionId)) throw new LobbyError(400, 'Invalid option.');

  if (round.archetype === 'opinion_vote') {
    const ownOption = round.options.find((option) => option.ownerPlayerId === actorPlayerId);
    if (ownOption?.id === optionId) throw new LobbyError(400, 'No self-votes.');
  }

  const votedRound = castVoteOnRound(round, actorPlayerId, optionId);
  if (!lobby.game) throw new LobbyError(409, 'Game has not started.');

  if (!allVotesComplete(votedRound, lobby.game.players)) {
    return saveLobby(replaceCurrentRound(lobby, votedRound));
  }

  const scoredRound = scoreRound(votedRound, lobby.game.players);
  const scoredLobby = replaceCurrentRound(lobby, scoredRound);
  return saveLobby({
    ...scoredLobby,
    game: applyRoundScore(scoredLobby.game!, scoredRound)
  });
}

export function castVote(code: string, actorPlayerId: PlayerId, optionId: string) {
  return submitLobbyVote(code, actorPlayerId, optionId);
}

export function revealLobbyRound(code: string, actorPlayerId: PlayerId) {
  const lobby = requireLobby(code);
  requireHost(lobby, actorPlayerId);
  const round = currentRound(lobby);
  if (!lobby.game) throw new LobbyError(409, 'Game has not started.');
  if (!allVotesComplete(round, lobby.game.players)) throw new LobbyError(409, 'Waiting for all votes.');
  const scoredRound = scoreRound(round, lobby.game.players);
  const scoredLobby = replaceCurrentRound(lobby, scoredRound);
  return saveLobby({
    ...scoredLobby,
    game: applyRoundScore(scoredLobby.game!, scoredRound)
  });
}

export function advanceLobbyRound(code: string, actorPlayerId: PlayerId) {
  const lobby = requireLobby(code);
  requireHost(lobby, actorPlayerId);
  const round = currentRound(lobby);
  if (round.phase !== 'reveal') throw new LobbyError(409, 'Round is not ready to advance.');
  if (!lobby.game) throw new LobbyError(409, 'Game has not started.');

  return saveLobby({
    ...lobby,
    game: lobby.game.phase === 'finished' ? lobby.game : advanceToNextRound(lobby.game)
  });
}

export function advanceRound(code: string, actorPlayerId: PlayerId) {
  return advanceLobbyRound(code, actorPlayerId);
}

export function resetLobbyGame(code: string, actorPlayerId: PlayerId) {
  const lobby = requireLobby(code);
  requireHost(lobby, actorPlayerId);
  return saveLobby({ ...lobby, game: undefined });
}

export function toErrorResponse(error: unknown) {
  if (error instanceof LobbyError) {
    return { status: error.status, body: { error: error.message } };
  }
  return { status: 500, body: { error: 'Something went wrong.' } };
}
