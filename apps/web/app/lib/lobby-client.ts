import { getDeckCatalog } from '@decoy/game-engine';
import type {
  DeckDefinition,
  LobbyMembership,
  LobbyState,
  Player,
  RoundState
} from '@decoy/types';

const PLAYER_KEY = 'decoy.player.identity.v2';
export const FALLBACK_POLL_MS = 30000;
export const DECKS = getDeckCatalog();

export function scoreRows(players: Player[], scores: Record<string, number>) {
  return [...players].sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0));
}

export function getStoredMemberships(): Record<string, LobbyMembership> {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(PLAYER_KEY);
    return raw ? (JSON.parse(raw) as Record<string, LobbyMembership>) : {};
  } catch {
    return {};
  }
}

export function getStoredMembership(code: string) {
  return getStoredMemberships()[code.toUpperCase()] ?? null;
}

export function storeMembership(membership: LobbyMembership) {
  if (typeof window === 'undefined') return;

  const current = getStoredMemberships();
  current[membership.code.toUpperCase()] = {
    ...membership,
    code: membership.code.toUpperCase()
  };
  window.localStorage.setItem(PLAYER_KEY, JSON.stringify(current));
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {})
    },
    cache: 'no-store'
  });

  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? 'Request failed.');
  }

  return data;
}

export function roundTitle(round: RoundState) {
  return round.archetype === 'bluff_trivia' ? 'Bluff trivia' : 'Opinion vote';
}

export function deckArchetypeLabel(archetype: DeckDefinition['archetype']) {
  return archetype === 'bluff_trivia' ? 'Bluff trivia' : 'Opinion vote';
}

export function deckFor(deckId: string) {
  return DECKS.find((deck) => deck.id === deckId) ?? DECKS[0];
}

export function currentRoundFor(lobby: LobbyState | null) {
  if (!lobby?.game) return null;
  return lobby.game.rounds[lobby.game.roundIndex] ?? null;
}
