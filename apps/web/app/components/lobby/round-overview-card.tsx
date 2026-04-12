import { Surface } from '@decoy/ui';
import type { LobbyState, RoundState } from '@decoy/types';
import { deckFor, roundTitle } from '../../lib/lobby-client';
import { eyebrowClass, mutedTextClass, panelClass, pillClass } from '../../lib/ui';

type RoundOverviewCardProps = {
  lobby: LobbyState;
  round: RoundState;
};

export function RoundOverviewCard({ lobby, round }: RoundOverviewCardProps) {
  return (
    <Surface>
      <div className={panelClass}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className={eyebrowClass}>
              Round {lobby.game!.roundIndex + 1} / {lobby.game!.roundCount}
            </p>
            <h2 className="text-2xl font-semibold text-slate-50">{roundTitle(round)}</h2>
          </div>
          <span className={pillClass}>{round.phase}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={pillClass}>{deckFor(lobby.game!.deckId).name}</span>
          <span className={pillClass}>{lobby.game!.roundCount} rounds</span>
        </div>
        <div className="space-y-2">
          <p className="text-sm text-slate-300">{round.prompt.category}</p>
          <p className="prompt-copy text-2xl font-medium leading-tight text-slate-50 md:text-3xl">
            {round.prompt.text}
          </p>
          <p className={mutedTextClass}>{round.prompt.votePrompt}</p>
        </div>
      </div>
    </Surface>
  );
}
