import type {
  BluffOption,
  BluffTriviaRoundState,
  DeckId,
  GameSession,
  LobbyConfig,
  LobbyState,
  OpinionOption,
  OpinionVoteRoundState,
  Player,
  PlayerId,
  PromptDefinition,
  RoundCount,
  RoundState
} from '@decoy/types';
import {
  DEFAULT_DECK_ID,
  DEFAULT_ROUND_COUNT,
  ROUND_COUNT_OPTIONS,
  getDeckCatalog,
  getDeckDefinition,
  getDefaultLobbyConfig,
  isDeckId,
  isRoundCount
} from './catalog';
import { getAllPrompts, getPromptsForDeck } from './prompts';

export {
  DEFAULT_DECK_ID,
  DEFAULT_ROUND_COUNT,
  ROUND_COUNT_OPTIONS,
  getDeckCatalog,
  getDeckDefinition,
  getDefaultLobbyConfig,
  getPromptsForDeck,
  isDeckId,
  isRoundCount
};

export function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createLobbyCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function normalizeLobbyConfig(config?: Partial<LobbyConfig>): LobbyConfig {
  return {
    deckId: config?.deckId ?? DEFAULT_DECK_ID,
    roundCount: config?.roundCount ?? DEFAULT_ROUND_COUNT
  };
}

export function createLobby(hostName: string): LobbyState {
  const host: Player = { id: createId('player'), name: hostName.trim() || 'Host', isHost: true };

  return {
    id: createId('lobby'),
    code: createLobbyCode(),
    hostPlayerId: host.id,
    createdAt: new Date().toISOString(),
    players: [host],
    revision: 0,
    config: getDefaultLobbyConfig()
  };
}

export function addPlayer(lobby: LobbyState, name: string): LobbyState {
  const trimmed = name.trim();
  if (!trimmed) return lobby;

  return {
    ...lobby,
    players: [...lobby.players, { id: createId('player'), name: trimmed }]
  };
}

export function updateLobbyConfig(lobby: LobbyState, config: LobbyConfig): LobbyState {
  return {
    ...lobby,
    config: normalizeLobbyConfig(config)
  };
}

function ensureDeckHasEnoughPrompts(deckId: DeckId, roundCount: RoundCount) {
  const deck = getDeckDefinition(deckId);
  if (!deck) {
    throw new Error(`Unknown deck: ${deckId}`);
  }

  const prompts = getPromptsForDeck(deckId);
  if (prompts.length < roundCount) {
    throw new Error(`Deck ${deckId} only has ${prompts.length} prompts.`);
  }

  return prompts;
}

function pickRandomPrompt(deckId: DeckId, usedPromptIds: string[]): PromptDefinition | null {
  const available = getPromptsForDeck(deckId).filter((prompt) => !usedPromptIds.includes(prompt.id));
  if (!available.length) return null;
  return available[Math.floor(Math.random() * available.length)] ?? null;
}

export function startGame(lobby: LobbyState): LobbyState {
  const config = normalizeLobbyConfig(lobby.config);
  ensureDeckHasEnoughPrompts(config.deckId, config.roundCount);

  const firstPrompt = pickRandomPrompt(config.deckId, []);
  if (!firstPrompt) {
    throw new Error(`Deck ${config.deckId} does not have a starting prompt.`);
  }

  const scores = Object.fromEntries(lobby.players.map((player) => [player.id, 0]));
  const firstRound = createRound(firstPrompt, lobby.players);

  return {
    ...lobby,
    config,
    game: {
      id: createId('game'),
      players: lobby.players,
      deckId: config.deckId,
      roundCount: config.roundCount,
      roundIndex: 0,
      usedPromptIds: [firstPrompt.id],
      rounds: [firstRound],
      scores,
      phase: 'in_round'
    }
  };
}

export function getPromptDeck() {
  return getAllPrompts();
}

export function createRound(prompt: PromptDefinition, players: Player[]): RoundState {
  if (prompt.archetype === 'bluff_trivia') {
    return {
      archetype: 'bluff_trivia',
      prompt,
      phase: 'submission',
      submissions: players.map((player) => ({ playerId: player.id, text: '' })),
      options: [],
      votes: {},
      scoreDelta: {},
      summary: []
    } satisfies BluffTriviaRoundState;
  }

  return {
    archetype: 'opinion_vote',
    prompt,
    phase: 'submission',
    submissions: players.map((player) => ({ playerId: player.id, text: '' })),
    options: [],
    votes: {},
    scoreDelta: {},
    summary: []
  } satisfies OpinionVoteRoundState;
}

export function submitAnswer(round: RoundState, playerId: PlayerId, text: string): RoundState {
  const clean = text.trim();
  if (!clean) return round;

  return {
    ...round,
    submissions: round.submissions.map((submission) =>
      submission.playerId === playerId ? { ...submission, text: clean } : submission
    )
  };
}

export function allSubmissionsComplete(round: RoundState) {
  return round.submissions.every((submission) => submission.text.trim().length > 0);
}

function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

export function lockSubmissions(round: RoundState): RoundState {
  if (!allSubmissionsComplete(round)) return round;

  if (round.archetype === 'bluff_trivia') {
    const options: BluffOption[] = shuffle([
      ...round.submissions.map((submission) => ({
        id: createId('option'),
        text: submission.text,
        kind: 'decoy' as const,
        ownerPlayerId: submission.playerId
      })),
      {
        id: createId('option'),
        text: round.prompt.canonicalAnswer ?? 'Unknown',
        kind: 'truth' as const
      }
    ]);

    return { ...round, phase: 'voting', options };
  }

  const options: OpinionOption[] = shuffle(
    round.submissions.map((submission) => ({
      id: createId('option'),
      text: submission.text,
      ownerPlayerId: submission.playerId
    }))
  );

  return { ...round, phase: 'voting', options };
}

export function castVote(round: RoundState, playerId: PlayerId, optionId: string): RoundState {
  return {
    ...round,
    votes: {
      ...round.votes,
      [playerId]: optionId
    }
  } as RoundState;
}

export function allVotesComplete(round: RoundState, players: Player[]): boolean {
  const eligiblePlayers = round.archetype === 'opinion_vote'
    ? players.filter((player) => {
        const ownOption = round.options.find((option) => option.ownerPlayerId === player.id);
        return Boolean(ownOption);
      })
    : players;

  return eligiblePlayers.every((player) => Boolean(round.votes[player.id]));
}

export function scoreRound(round: RoundState, players: Player[]): RoundState {
  if (round.phase !== 'voting') return round;

  const validVotes = Object.entries(round.votes).filter(([voterId, optionId]) => {
    const option = round.options.find((candidate) => candidate.id === optionId);
    if (!option) return false;
    return option.ownerPlayerId !== voterId;
  });

  if (round.archetype === 'bluff_trivia') {
    const truth = round.options.find((option) => option.kind === 'truth');
    if (!truth) return round;

    const scoreDelta: Record<PlayerId, number> = Object.fromEntries(players.map((player) => [player.id, 0]));
    const summary: string[] = [];

    validVotes.forEach(([voterId, optionId]) => {
      const player = players.find((candidate) => candidate.id === voterId);
      const votedOption = round.options.find((option) => option.id === optionId);
      if (!player || !votedOption) return;

      if (votedOption.kind === 'truth') {
        scoreDelta[player.id] += 1000;
        summary.push(`${player.name} spotted the real answer for +1000.`);
      } else if (votedOption.ownerPlayerId) {
        scoreDelta[votedOption.ownerPlayerId] += 500;
        const owner = players.find((candidate) => candidate.id === votedOption.ownerPlayerId);
        summary.push(`${player.name} got fooled by ${owner?.name ?? 'someone'} for +500 to the bluffer.`);
      }
    });

    return { ...round, phase: 'reveal', scoreDelta, summary };
  }

  const scoreDelta: Record<PlayerId, number> = Object.fromEntries(players.map((player) => [player.id, 0]));
  const summary: string[] = [];

  validVotes.forEach(([, optionId]) => {
    const option = round.options.find((candidate) => candidate.id === optionId);
    if (!option) return;
    scoreDelta[option.ownerPlayerId] += 700;
  });

  round.options
    .map((option) => ({
      option,
      votes: validVotes.filter(([, vote]) => vote === option.id).length
    }))
    .sort((left, right) => right.votes - left.votes)
    .forEach(({ option, votes }, index) => {
      const player = players.find((candidate) => candidate.id === option.ownerPlayerId);
      if (!player) return;
      if (index === 0 && votes > 0) {
        scoreDelta[player.id] += 300;
      }
      summary.push(`${player.name} pulled ${votes} vote${votes === 1 ? '' : 's'}${index === 0 && votes > 0 ? ' and the crowd bonus.' : '.'}`);
    });

  return { ...round, phase: 'reveal', scoreDelta, summary };
}

export function applyRoundScore(game: GameSession, round: RoundState): GameSession {
  const nextScores = { ...game.scores };
  Object.entries(round.scoreDelta).forEach(([playerId, delta]) => {
    nextScores[playerId] = (nextScores[playerId] ?? 0) + delta;
  });

  const isLastRound = game.roundIndex >= game.roundCount - 1;

  return {
    ...game,
    scores: nextScores,
    phase: isLastRound ? 'finished' : 'intermission',
    rounds: game.rounds.map((existingRound, index) => (index === game.roundIndex ? round : existingRound))
  };
}

export function advanceToNextRound(game: GameSession): GameSession {
  if (game.roundIndex >= game.roundCount - 1) {
    return { ...game, phase: 'finished' };
  }

  const prompt = pickRandomPrompt(game.deckId, game.usedPromptIds);
  if (!prompt) {
    return { ...game, phase: 'finished' };
  }

  const nextRoundIndex = game.roundIndex + 1;

  return {
    ...game,
    roundIndex: nextRoundIndex,
    phase: 'in_round',
    usedPromptIds: [...game.usedPromptIds, prompt.id],
    rounds: [...game.rounds, createRound(prompt, game.players)]
  };
}
