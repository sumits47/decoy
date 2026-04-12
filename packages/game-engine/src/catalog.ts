import type { DeckDefinition, DeckId, LobbyConfig, RoundCount } from '@decoy/types';

export const DEFAULT_DECK_ID: DeckId = 'truth_comes_out';
export const DEFAULT_ROUND_COUNT: RoundCount = 5;
export const ROUND_COUNT_OPTIONS: RoundCount[] = [5, 7, 10];

const deckCatalog: DeckDefinition[] = [
  {
    id: 'truth_comes_out',
    name: 'The Truth Comes Out',
    description: 'Personal questions where the room crowns the funniest, messiest, or most believable confession.',
    archetype: 'opinion_vote',
    imagePath: '/decks/truth-comes-out.jpg'
  },
  {
    id: 'is_that_a_fact',
    name: 'Is That a Fact?',
    description: 'Oddball trivia prompts built for brazen lies and one sneaky real answer.',
    archetype: 'bluff_trivia',
    imagePath: '/decks/is-that-a-fact.jpg'
  },
  {
    id: 'movie_bluff',
    name: 'Movie Bluff',
    description: 'Real movie titles, fake plots, and a room full of shameless pitch meetings.',
    archetype: 'bluff_trivia',
    imagePath: '/decks/movie-bluff.jpg'
  },
  {
    id: 'word_up',
    name: 'Word Up',
    description: 'Obscure words, suspicious definitions, and one dictionary gremlin telling the truth.',
    archetype: 'bluff_trivia',
    imagePath: '/decks/word-up.jpg'
  },
  {
    id: 'naked_truth',
    name: 'The Naked Truth',
    description: 'Cheekier personal prompts for players who are comfortable being scandalous on purpose.',
    archetype: 'opinion_vote',
    isAdult: true,
    imagePath: '/decks/naked-truth.jpg'
  },
  {
    id: 'pop_culture',
    name: 'Pop Culture Deck',
    description: 'Celebrity weirdness, entertainment lore, and suspiciously plausible pre-fame facts.',
    archetype: 'bluff_trivia',
    imagePath: '/decks/pop-culture.jpg'
  },
  {
    id: 'holiday_seasonal',
    name: 'Holiday / Seasonal Deck',
    description: 'Festive prompts full of haunted customs, cheerful nonsense, and seasonal chaos.',
    archetype: 'bluff_trivia',
    imagePath: '/decks/holiday-seasonal.svg'
  },
  {
    id: 'relationship_party',
    name: 'Relationship / Party Deck',
    description: 'Friend-group and couple prompts designed to expose lovable habits and petty grudges.',
    archetype: 'opinion_vote',
    imagePath: '/decks/relationship-party.jpg'
  },
  {
    id: 'niche_trivia',
    name: 'Niche Trivia Deck',
    description: 'Hyper-specific facts for the friend who owns too many rabbit holes and receipts.',
    archetype: 'bluff_trivia',
    imagePath: '/decks/niche-trivia.jpg'
  }
];

export function getDeckCatalog() {
  return deckCatalog;
}

export function getDeckDefinition(deckId: DeckId) {
  return deckCatalog.find((deck) => deck.id === deckId);
}

export function isDeckId(value: string): value is DeckId {
  return deckCatalog.some((deck) => deck.id === value);
}

export function isRoundCount(value: number): value is RoundCount {
  return ROUND_COUNT_OPTIONS.includes(value as RoundCount);
}

export function getDefaultLobbyConfig(): LobbyConfig {
  return {
    deckId: DEFAULT_DECK_ID,
    roundCount: DEFAULT_ROUND_COUNT
  };
}
