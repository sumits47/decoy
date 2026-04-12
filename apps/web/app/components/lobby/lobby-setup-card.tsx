import { Surface } from '@decoy/ui';
import { ROUND_COUNT_OPTIONS } from '@decoy/game-engine';
import type { DeckDefinition, LobbyState, RoundCount } from '@decoy/types';
import {
  eyebrowClass,
  mutedTextClass,
  panelClass,
  primaryButtonClass
} from '../../lib/ui';
import { cn } from '../../lib/cn';

type LobbySetupCardProps = {
  busyAction: string | null;
  isHost: boolean;
  lobby: LobbyState;
  playerReady: boolean;
  onStart: () => void;
  onUpdateRoundCount: (count: RoundCount) => void;
};

export function LobbySetupCard({
  busyAction,
  isHost,
  lobby,
  playerReady,
  onStart,
  onUpdateRoundCount
}: LobbySetupCardProps) {
  return (
    <Surface>
      <div className={panelClass}>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className={eyebrowClass}>Rounds</p>
            <span className={mutedTextClass}>Hosts lock the match length here.</span>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Choose round count">
            {ROUND_COUNT_OPTIONS.map((count) => {
              const active = lobby.config.roundCount === count;
              return (
                <button
                  key={count}
                  type="button"
                  className={cn(
                    'rounded-full border px-4 py-2 text-sm font-semibold transition',
                    active
                      ? 'border-cyan-300/50 bg-cyan-300/12 text-cyan-50'
                      : 'border-white/12 bg-white/5 text-slate-100 hover:bg-white/10'
                  )}
                  data-testid={`round-count-${count}`}
                  disabled={!isHost || busyAction === 'settings'}
                  onClick={() => onUpdateRoundCount(count)}
                >
                  {count} rounds
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <p className={eyebrowClass}>Start game</p>
          <button
            className={`${primaryButtonClass} w-full`}
            data-testid="start-game"
            disabled={
              !isHost ||
              lobby.players.length < 3 ||
              busyAction === 'start' ||
              busyAction === 'settings'
            }
            onClick={onStart}
          >
            Start game
          </button>
          <p className={mutedTextClass}>
            {playerReady
              ? 'Start once at least three players are in and the deck feels right.'
              : 'This browser has not joined the room yet. Use the join screen with this code to participate.'}
          </p>
        </div>
      </div>
    </Surface>
  );
}
