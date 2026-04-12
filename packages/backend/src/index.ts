import * as Ably from 'ably';
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
import { prisma } from '@decoy/database';
import {
  LOBBY_UPDATED_EVENT,
  getLobbyChannelName,
  type LobbyCode,
  type LobbyMembership,
  type LobbyRealtimeEvent,
  type LobbyState,
  type Player,
  type PlayerId,
  type PlayerSessionToken,
  type RoundState
} from '@decoy/types';

class LobbyError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeLobbyState(state: LobbyState): LobbyState {
  return {
    ...state,
    revision: typeof state.revision === 'number' ? state.revision : 0
  };
}

function deserializeLobby(stateJson: unknown): LobbyState {
  return normalizeLobbyState(clone(stateJson as LobbyState));
}

function serializeLobby(lobby: LobbyState) {
  return clone(lobby) as any;
}

let realtimeClient: Ably.Rest | null | undefined;

function getRealtimeClient() {
  if (realtimeClient !== undefined) return realtimeClient;

  const key = process.env.ABLY_API_KEY;
  realtimeClient = key ? new Ably.Rest(key) : null;
  return realtimeClient;
}

function withNextRevision(lobby: LobbyState): LobbyState {
  const snapshot = normalizeLobbyState(clone(lobby));
  return {
    ...snapshot,
    revision: snapshot.revision + 1
  };
}

async function publishLobbyUpdate(lobby: LobbyState) {
  const realtime = getRealtimeClient();
  if (!realtime) return;

  const event: LobbyRealtimeEvent = {
    code: lobby.code,
    revision: lobby.revision,
    lobby
  };

  try {
    await realtime.channels.get(getLobbyChannelName(lobby.code)).publish(LOBBY_UPDATED_EVENT, event);
  } catch (error) {
    console.error('Failed to publish lobby update', { code: lobby.code, revision: lobby.revision, error });
  }
}

async function requireLobby(code: string) {
  const lobbyRecord = await prisma.lobby.findUnique({ where: { code: normalizeCode(code) } });
  if (!lobbyRecord) throw new LobbyError(404, 'Lobby not found.');
  return deserializeLobby(lobbyRecord.stateJson);
}

async function saveLobby(lobby: LobbyState) {
  const snapshot = withNextRevision(lobby);
  await prisma.lobby.upsert({
    where: { code: normalizeCode(snapshot.code) },
    create: {
      id: snapshot.id,
      code: normalizeCode(snapshot.code),
      hostPlayerId: snapshot.hostPlayerId,
      createdAt: new Date(snapshot.createdAt),
      stateJson: serializeLobby(snapshot)
    },
    update: {
      hostPlayerId: snapshot.hostPlayerId,
      stateJson: serializeLobby(snapshot)
    }
  });

  await publishLobbyUpdate(snapshot);
  return snapshot;
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

async function createMembership(code: LobbyCode, player: Player): Promise<LobbyMembership> {
  const playerSessionToken = createId('session');
  await prisma.playerSession.create({
    data: {
      token: playerSessionToken,
      lobbyCode: normalizeCode(code),
      playerId: player.id,
      playerName: player.name
    }
  });
  return { code, playerId: player.id, playerName: player.name, playerSessionToken };
}

async function resolveSessionPlayerId(code: string, playerSessionToken: string): Promise<PlayerId | null> {
  if (!playerSessionToken.trim()) return null;
  const session = await prisma.playerSession.findUnique({ where: { token: playerSessionToken } });
  if (!session) return null;
  return normalizeCode(session.lobbyCode) === normalizeCode(code) ? session.playerId : null;
}

async function requireSessionPlayer(lobby: LobbyState, playerSessionToken: string) {
  const playerId = await resolveSessionPlayerId(lobby.code, playerSessionToken);
  if (!playerId) {
    throw new LobbyError(403, 'Join this lobby from this browser first.');
  }
  return requirePlayer(lobby, playerId);
}

async function requireHostSession(lobby: LobbyState, playerSessionToken: string) {
  const player = await requireSessionPlayer(lobby, playerSessionToken);
  requireHost(lobby, player.id);
  return player;
}

export async function createLobbySession(hostName: string) {
  const lobby = await saveLobby(createLobbyState(hostName));
  const player = lobby.players.find((candidate) => candidate.id === lobby.hostPlayerId);
  if (!player) throw new LobbyError(500, 'Could not create host session.');
  return { lobby, player, membership: await createMembership(lobby.code, player) };
}

export async function createLobby(hostName: string) {
  return createLobbySession(hostName);
}

export async function getLobbySnapshot(code: string) {
  return clone(await requireLobby(code));
}

export async function fetchSnapshot(code: string) {
  return getLobbySnapshot(code);
}

export async function joinLobby(code: string, name: string, existingSessionToken?: string) {
  const lobby = await requireLobby(code);
  const existingPlayerId = await resolveSessionPlayerId(lobby.code, existingSessionToken ?? '');
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

  const savedLobby = await saveLobby(nextLobby);
  return { lobby: savedLobby, player: clone(player), membership: await createMembership(savedLobby.code, player) };
}

export async function startLobbyGame(code: string, actorSessionToken: PlayerSessionToken) {
  const lobby = await requireLobby(code);
  await requireHostSession(lobby, actorSessionToken);
  if (lobby.players.length < 3) throw new LobbyError(400, 'Need at least 3 players.');
  return saveLobby(startGameState(lobby));
}

export async function startGame(code: string, actorSessionToken: PlayerSessionToken) {
  return startLobbyGame(code, actorSessionToken);
}

export async function submitLobbyAnswer(code: string, actorSessionToken: PlayerSessionToken, text: string) {
  const lobby = await requireLobby(code);
  const actor = await requireSessionPlayer(lobby, actorSessionToken);
  const round = currentRound(lobby);
  if (round.phase !== 'submission') throw new LobbyError(409, 'Submission phase is over.');
  if (round.submissions.some((submission) => submission.playerId === actor.id && submission.text.trim().length > 0)) {
    throw new LobbyError(409, 'Answer already submitted.');
  }

  const submitted = submitRoundAnswer(round, actor.id, text);
  const nextRound = allSubmissionsComplete(submitted) ? lockSubmissions(submitted) : submitted;
  return saveLobby(replaceCurrentRound(lobby, nextRound));
}

export async function submitAnswer(code: string, actorSessionToken: PlayerSessionToken, text: string) {
  return submitLobbyAnswer(code, actorSessionToken, text);
}

export async function openLobbyVoting(code: string, actorSessionToken: PlayerSessionToken) {
  const lobby = await requireLobby(code);
  await requireHostSession(lobby, actorSessionToken);
  const round = currentRound(lobby);
  if (!allSubmissionsComplete(round)) throw new LobbyError(409, 'Waiting for all submissions.');
  return saveLobby(replaceCurrentRound(lobby, lockSubmissions(round)));
}

export async function submitLobbyVote(code: string, actorSessionToken: PlayerSessionToken, optionId: string) {
  const lobby = await requireLobby(code);
  const actor = await requireSessionPlayer(lobby, actorSessionToken);
  const round = currentRound(lobby);
  if (round.phase !== 'voting') throw new LobbyError(409, 'Voting is not open.');
  if (round.votes[actor.id]) throw new LobbyError(409, 'Vote already submitted.');
  if (!round.options.some((option) => option.id === optionId)) throw new LobbyError(400, 'Invalid option.');

  const selectedOption = round.options.find((option) => option.id === optionId);
  if (selectedOption?.ownerPlayerId === actor.id) {
    throw new LobbyError(400, 'No self-votes.');
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

export async function castVote(code: string, actorSessionToken: PlayerSessionToken, optionId: string) {
  return submitLobbyVote(code, actorSessionToken, optionId);
}

export async function revealLobbyRound(code: string, actorSessionToken: PlayerSessionToken) {
  const lobby = await requireLobby(code);
  await requireHostSession(lobby, actorSessionToken);
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

export async function advanceLobbyRound(code: string, actorSessionToken: PlayerSessionToken) {
  const lobby = await requireLobby(code);
  await requireHostSession(lobby, actorSessionToken);
  const round = currentRound(lobby);
  if (round.phase !== 'reveal') throw new LobbyError(409, 'Round is not ready to advance.');
  if (!lobby.game) throw new LobbyError(409, 'Game has not started.');

  return saveLobby({
    ...lobby,
    game: lobby.game.phase === 'finished' ? lobby.game : advanceToNextRound(lobby.game)
  });
}

export async function advanceRound(code: string, actorSessionToken: PlayerSessionToken) {
  return advanceLobbyRound(code, actorSessionToken);
}

export async function resetLobbyGame(code: string, actorSessionToken: PlayerSessionToken) {
  const lobby = await requireLobby(code);
  await requireHostSession(lobby, actorSessionToken);
  return saveLobby({ ...lobby, game: undefined });
}

export async function createLobbyRealtimeTokenRequest(code: string) {
  await requireLobby(code);

  const realtime = getRealtimeClient();
  if (!realtime) {
    throw new LobbyError(503, 'Realtime is not configured on the server.');
  }

  return realtime.auth.createTokenRequest({
    capability: JSON.stringify({
      [getLobbyChannelName(code)]: ['subscribe']
    }),
    ttl: 60 * 60 * 1000
  });
}

export function toErrorResponse(error: unknown) {
  if (error instanceof LobbyError) {
    return { status: error.status, body: { error: error.message } };
  }

  console.error('Unexpected lobby backend error', error);
  return { status: 500, body: { error: 'Something went wrong.' } };
}
