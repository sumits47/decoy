import {
  addPlayer,
  advanceToNextRound,
  allSubmissionsComplete,
  allVotesComplete,
  applyRoundScore,
  castVote as castVoteOnRound,
  createId,
  createLobby as createLobbyState,
  lockSubmissions,
  scoreRound,
  startGame as startGameState,
  submitAnswer as submitRoundAnswer
} from '@decoy/game-engine';
import type { LobbyCode, LobbyMembership, LobbyState, Player, PlayerId, PlayerSessionToken, RoundState } from '@decoy/types';

class LobbyError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type LobbyStore = Map<LobbyCode, LobbyState>;
type SessionRecord = { code: LobbyCode; playerId: PlayerId };
type SessionStore = Map<PlayerSessionToken, SessionRecord>;

const globalStore = globalThis as typeof globalThis & {
  __decoyLobbyStore__?: LobbyStore;
  __decoyPlayerSessionStore__?: SessionStore;
};

function getStore(): LobbyStore {
  if (!globalStore.__decoyLobbyStore__) {
    globalStore.__decoyLobbyStore__ = new Map();
  }
  return globalStore.__decoyLobbyStore__;
}

function getSessionStore(): SessionStore {
  if (!globalStore.__decoyPlayerSessionStore__) {
    globalStore.__decoyPlayerSessionStore__ = new Map();
  }
  return globalStore.__decoyPlayerSessionStore__;
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

function createMembership(code: LobbyCode, player: Player): LobbyMembership {
  const playerSessionToken = createId('session');
  getSessionStore().set(playerSessionToken, { code, playerId: player.id });
  return { code, playerId: player.id, playerName: player.name, playerSessionToken };
}

function resolveSessionPlayerId(code: string, playerSessionToken: string): PlayerId | null {
  if (!playerSessionToken.trim()) return null;
  const session = getSessionStore().get(playerSessionToken);
  if (!session) return null;
  return normalizeCode(session.code) === normalizeCode(code) ? session.playerId : null;
}

function requireSessionPlayer(lobby: LobbyState, playerSessionToken: string) {
  const playerId = resolveSessionPlayerId(lobby.code, playerSessionToken);
  if (!playerId) {
    throw new LobbyError(403, 'Join this lobby from this browser first.');
  }
  return requirePlayer(lobby, playerId);
}

function requireHostSession(lobby: LobbyState, playerSessionToken: string) {
  const player = requireSessionPlayer(lobby, playerSessionToken);
  requireHost(lobby, player.id);
  return player;
}

export function createLobbySession(hostName: string) {
  const lobby = saveLobby(createLobbyState(hostName));
  const player = lobby.players.find((candidate) => candidate.id === lobby.hostPlayerId);
  if (!player) throw new LobbyError(500, 'Could not create host session.');
  return { lobby, player, membership: createMembership(lobby.code, player) };
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

export function joinLobby(code: string, name: string, existingSessionToken?: string) {
  const lobby = requireLobby(code);
  const existingPlayerId = resolveSessionPlayerId(lobby.code, existingSessionToken ?? '');
  if (existingPlayerId) {
    const player = requirePlayer(lobby, existingPlayerId);
    return {
      lobby: clone(lobby),
      player: clone(player),
      membership: {
        code: lobby.code,
        playerId: player.id,
        playerName: player.name,
        playerSessionToken: existingSessionToken as string
      }
    };
  }

  const nextLobby = addPlayer(lobby, name || `Player ${lobby.players.length + 1}`);
  if (nextLobby.players.length === lobby.players.length) {
    throw new LobbyError(400, 'Enter a player name.');
  }

  const player = nextLobby.players[nextLobby.players.length - 1] as Player | undefined;
  if (!player) {
    throw new LobbyError(500, 'Could not join lobby.');
  }

  const savedLobby = saveLobby(nextLobby);
  return { lobby: savedLobby, player: clone(player), membership: createMembership(savedLobby.code, player) };
}

export function startLobbyGame(code: string, actorSessionToken: PlayerSessionToken) {
  const lobby = requireLobby(code);
  requireHostSession(lobby, actorSessionToken);
  if (lobby.players.length < 3) throw new LobbyError(400, 'Need at least 3 players.');
  return saveLobby(startGameState(lobby));
}

export function startGame(code: string, actorSessionToken: PlayerSessionToken) {
  return startLobbyGame(code, actorSessionToken);
}

export function submitLobbyAnswer(code: string, actorSessionToken: PlayerSessionToken, text: string) {
  const lobby = requireLobby(code);
  const actor = requireSessionPlayer(lobby, actorSessionToken);
  const round = currentRound(lobby);
  if (round.phase !== 'submission') throw new LobbyError(409, 'Submission phase is over.');

  const submitted = submitRoundAnswer(round, actor.id, text);
  const nextRound = allSubmissionsComplete(submitted) ? lockSubmissions(submitted) : submitted;
  return saveLobby(replaceCurrentRound(lobby, nextRound));
}

export function submitAnswer(code: string, actorSessionToken: PlayerSessionToken, text: string) {
  return submitLobbyAnswer(code, actorSessionToken, text);
}

export function openLobbyVoting(code: string, actorSessionToken: PlayerSessionToken) {
  const lobby = requireLobby(code);
  requireHostSession(lobby, actorSessionToken);
  const round = currentRound(lobby);
  if (!allSubmissionsComplete(round)) throw new LobbyError(409, 'Waiting for all submissions.');
  return saveLobby(replaceCurrentRound(lobby, lockSubmissions(round)));
}

export function submitLobbyVote(code: string, actorSessionToken: PlayerSessionToken, optionId: string) {
  const lobby = requireLobby(code);
  const actor = requireSessionPlayer(lobby, actorSessionToken);
  const round = currentRound(lobby);
  if (round.phase !== 'voting') throw new LobbyError(409, 'Voting is not open.');
  if (!round.options.some((option) => option.id === optionId)) throw new LobbyError(400, 'Invalid option.');

  if (round.archetype === 'opinion_vote') {
    const ownOption = round.options.find((option) => option.ownerPlayerId === actor.id);
    if (ownOption?.id === optionId) throw new LobbyError(400, 'No self-votes.');
  }

  const votedRound = castVoteOnRound(round, actor.id, optionId);
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

export function castVote(code: string, actorSessionToken: PlayerSessionToken, optionId: string) {
  return submitLobbyVote(code, actorSessionToken, optionId);
}

export function revealLobbyRound(code: string, actorSessionToken: PlayerSessionToken) {
  const lobby = requireLobby(code);
  requireHostSession(lobby, actorSessionToken);
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

export function advanceLobbyRound(code: string, actorSessionToken: PlayerSessionToken) {
  const lobby = requireLobby(code);
  requireHostSession(lobby, actorSessionToken);
  const round = currentRound(lobby);
  if (round.phase !== 'reveal') throw new LobbyError(409, 'Round is not ready to advance.');
  if (!lobby.game) throw new LobbyError(409, 'Game has not started.');

  return saveLobby({
    ...lobby,
    game: lobby.game.phase === 'finished' ? lobby.game : advanceToNextRound(lobby.game)
  });
}

export function advanceRound(code: string, actorSessionToken: PlayerSessionToken) {
  return advanceLobbyRound(code, actorSessionToken);
}

export function resetLobbyGame(code: string, actorSessionToken: PlayerSessionToken) {
  const lobby = requireLobby(code);
  requireHostSession(lobby, actorSessionToken);
  return saveLobby({ ...lobby, game: undefined });
}

export function toErrorResponse(error: unknown) {
  if (error instanceof LobbyError) {
    return { status: error.status, body: { error: error.message } };
  }
  return { status: 500, body: { error: 'Something went wrong.' } };
}
