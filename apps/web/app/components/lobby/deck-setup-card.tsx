import Link from 'next/link';
import { Surface } from '@decoy/ui';
import type { DeckDefinition, RoundCount } from '@decoy/types';
import { DeckCard } from '../deck-card';
import { eyebrowClass, panelClass, pillClass, secondaryButtonClass } from '../../lib/ui';

type DeckSetupCardProps = {
  deckBrowserHref: string;
  selectedDeck: DeckDefinition;
  selectedRoundCount: RoundCount;
};

export function DeckSetupCard({
  deckBrowserHref,
  selectedDeck,
  selectedRoundCount
}: DeckSetupCardProps) {
  return (
    <Surface>
      <div className={panelClass} data-testid="deck-setup">
        <div className="space-y-2">
          <p className={eyebrowClass}>Deck preview</p>
        </div>
        <div className="max-w-xl">
          <DeckCard
            deck={selectedDeck}
            active
            imageTestId="selected-deck-art"
            footer={
              <div className="flex flex-wrap gap-2">
                <span className={pillClass}>{selectedRoundCount} rounds</span>
              </div>
            }
          />
        </div>
        <Link
          className={`${secondaryButtonClass} w-full max-w-xl`}
          href={deckBrowserHref}
          data-testid="change-deck"
        >
          Change deck
        </Link>
      </div>
    </Surface>
  );
}
