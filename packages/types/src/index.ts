export type PlayerId = string;
export type LobbyCode = string;
export type PlayerSessionToken = string;

export type RoundArchetype = 'bluff_trivia' | 'opinion_vote';
export type ResolutionType = 'correct_answer' | 'audience_vote';
export type MatchPhase = 'lobby' | 'in_round' | 'intermission' | 'finished';
export type RoundPhase = 'submission' | 'voting' | 'reveal';

export interface Player {
  id: PlayerId;
  name: string;
  isHost?: boolean;
}

export interface PromptDefinition {
  id: string;
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
  roundIndex: number;
  rounds: RoundState[];
  scores: Record<PlayerId, number>;
  phase: MatchPhase;
}

export interface LobbyState extends LobbySummary {
  players: Player[];
  game?: GameSession;
}

export interface LobbyMembership {
  code: LobbyCode;
  playerId: PlayerId;
  playerName: string;
  playerSessionToken: PlayerSessionToken;
}
