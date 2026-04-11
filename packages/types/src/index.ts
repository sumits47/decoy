export type PlayerId = string;

export interface LobbySummary {
  id: string;
  code: string;
  hostPlayerId: PlayerId;
  createdAt: string;
}
