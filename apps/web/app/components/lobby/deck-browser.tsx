import Link from 'next/link';
import { Surface } from '@decoy/ui';
import type { DeckDefinition, LobbyState, RoundCount } from '@decoy/types';
import { DECKS } from '../../lib/lobby-client';
import {
  eyebrowClass,
  mutedTextClass,
  panelClass,
  pillClass,
  secondaryButtonClass,
  sectionTitleClass
} from '../../lib/ui';
import { DeckCard } from '../deck-card';
import { DeckTypePill } from '../deck-type-pill';

type DeckBrowserProps = {
  busyAction: string | null;
  isHost: boolean;
  lobby: LobbyState;
  lobbyHref: string;
  selectedDeck: DeckDefinition;
  selectedRoundCount: RoundCount;
  onUpdateDeck: (deckId: DeckDefinition['id']) => void;
};

export function DeckBrowser({
  busyAction,
  isHost,
  lobby,
  lobbyHref,
  selectedDeck,
  selectedRoundCount,
  onUpdateDeck
}: DeckBrowserProps) {
  return (
    <Surface>
      <div className={panelClass} data-testid="deck-browser">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl space-y-3">
            <p className={eyebrowClass}>Deck library</p>
            <h2 className={sectionTitleClass}>Choose the room&apos;s next flavor of chaos</h2>
            <p className={mutedTextClass}>
              {isHost
                ? 'Pick a deck here, then head back to the lobby to start the game.'
                : 'Only the host can change decks, but everyone can preview what is selected.'}
            </p>
          </div>
          <Link className={secondaryButtonClass} href={lobbyHref}>
            Back to lobby
          </Link>
        </div>

        <div className="grid gap-6 rounded-[28px] border border-cyan-300/20 bg-[linear-gradient(145deg,rgba(17,29,52,0.96),rgba(11,21,38,0.92))] p-5 md:grid-cols-[220px_minmax(0,1fr)] md:items-center">
          <img
            className="aspect-square w-full rounded-3xl border border-white/10 bg-white/5 object-cover"
            src={selectedDeck.imagePath}
            alt={selectedDeck.name}
            data-testid="selected-deck-art"
          />
          <div className="space-y-3">
            <p className={eyebrowClass}>Currently selected</p>
            <h3 className="text-2xl font-semibold text-slate-50">{selectedDeck.name}</h3>
            <div className="flex flex-wrap gap-2">
              <DeckTypePill archetype={selectedDeck.archetype} />
              <span className={pillClass}>{selectedRoundCount} rounds</span>
              {selectedDeck.isAdult ? <span className={pillClass}>Adult deck</span> : null}
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {DECKS.map((deck) => (
            <DeckCard
              key={deck.id}
              deck={deck}
              active={lobby.config.deckId === deck.id}
              disabled={!isHost || busyAction === 'settings'}
              onClick={
                isHost && busyAction !== 'settings' ? () => onUpdateDeck(deck.id) : undefined
              }
            />
          ))}
        </div>
      </div>
    </Surface>
  );
}
