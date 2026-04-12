export type PlayerId = string;
export type LobbyCode = string;
export type PlayerSessionToken = string;
export const LOBBY_UPDATED_EVENT = 'lobby.updated';

export type RoundArchetype = 'bluff_trivia' | 'opinion_vote';
export type ResolutionType = 'correct_answer' | 'audience_vote';
export type MatchPhase = 'lobby' | 'in_round' | 'intermission' | 'finished';
export type RoundPhase = 'submission' | 'voting' | 'reveal';
export type DeckId =
  | 'truth_comes_out'
  | 'is_that_a_fact'
  | 'movie_bluff'
  | 'word_up'
  | 'naked_truth'
  | 'pop_culture'
  | 'holiday_seasonal'
  | 'relationship_party'
  | 'niche_trivia';
export type RoundCount = 5 | 7 | 10;

export interface Player {
  id: PlayerId;
  name: string;
  isHost?: boolean;
}

export interface DeckDefinition {
  id: DeckId;
  name: string;
  description: string;
  archetype: RoundArchetype;
  isAdult?: boolean;
  imagePath: string;
}

export interface LobbyConfig {
  deckId: DeckId;
  roundCount: RoundCount;
}

export interface PromptDefinition {
  id: string;
  deckId: DeckId;
  archetype: RoundArchetype;
  resolutionType: ResolutionType;
  category: string;
  text: string;
  canonicalAnswer?: string;
  votePrompt: string;
}

export interface LobbySummary {
  id: string;
  code: LobbyCode;
  hostPlayerId: PlayerId;
  createdAt: string;
}

export interface BluffSubmission {
  playerId: PlayerId;
  text: string;
}

export interface BluffOption {
  id: string;
  text: string;
  kind: 'truth' | 'decoy';
  ownerPlayerId?: PlayerId;
}

export interface BluffTriviaRoundState {
  archetype: 'bluff_trivia';
  prompt: PromptDefinition;
  phase: RoundPhase;
  submissions: BluffSubmission[];
  options: BluffOption[];
  votes: Record<PlayerId, string>;
  scoreDelta: Record<PlayerId, number>;
  summary: string[];
}

export interface OpinionSubmission {
  playerId: PlayerId;
  text: string;
}

export interface OpinionOption {
  id: string;
  text: string;
  ownerPlayerId: PlayerId;
}

export interface OpinionVoteRoundState {
  archetype: 'opinion_vote';
  prompt: PromptDefinition;
  phase: RoundPhase;
  submissions: OpinionSubmission[];
  options: OpinionOption[];
  votes: Record<PlayerId, string>;
  scoreDelta: Record<PlayerId, number>;
  summary: string[];
}

export type RoundState = BluffTriviaRoundState | OpinionVoteRoundState;

export interface GameSession {
  id: string;
  players: Player[];
  deckId: DeckId;
  roundCount: RoundCount;
  roundIndex: number;
  usedPromptIds: string[];
  rounds: RoundState[];
  scores: Record<PlayerId, number>;
  phase: MatchPhase;
}

export interface LobbyState extends LobbySummary {
  players: Player[];
  revision: number;
  config: LobbyConfig;
  game?: GameSession;
}

export interface LobbyMembership {
  code: LobbyCode;
  playerId: PlayerId;
  playerName: string;
  playerSessionToken: PlayerSessionToken;
}

export interface LobbyRealtimeEvent {
  code: LobbyCode;
  revision: number;
  lobby: LobbyState;
}

export function getLobbyChannelName(code: string) {
  return `lobby:${code.trim().toUpperCase()}`;
}
