export const roundPhases = ['lobby', 'prompt', 'submit', 'vote', 'reveal', 'score'] as const;
export type RoundPhase = (typeof roundPhases)[number];
