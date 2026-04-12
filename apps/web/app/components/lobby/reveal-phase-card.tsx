import { Surface } from '@decoy/ui';
import type { LobbyState, Player, RoundState } from '@decoy/types';
import {
  eyebrowClass,
  listRowClass,
  panelClass,
  pillClass,
  primaryButtonClass
} from '../../lib/ui';

type RevealPhaseCardProps = {
  busyAction: string | null;
  currentRound: RoundState;
  isHost: boolean;
  lobby: LobbyState;
  players: Player[];
  onNextRound: () => void;
  onReset: () => void;
};

export function RevealPhaseCard({
  busyAction,
  currentRound,
  isHost,
  lobby,
  onNextRound,
  onReset,
  players
}: RevealPhaseCardProps) {
  return (
    <Surface>
      <div className={panelClass}>
        <p className={eyebrowClass}>Reveal</p>
        <div className="space-y-3">
          {currentRound.archetype === 'bluff_trivia' ? (
            <p className="rounded-3xl border border-cyan-300/20 bg-gradient-to-r from-cyan-300/15 to-fuchsia-500/20 px-4 py-4 text-sm font-semibold text-slate-50">
              Truth: {currentRound.prompt.canonicalAnswer}
            </p>
          ) : (
            <p className="rounded-3xl border border-cyan-300/20 bg-gradient-to-r from-cyan-300/15 to-fuchsia-500/20 px-4 py-4 text-sm font-semibold text-slate-50">
              The room has spoken.
            </p>
          )}
          {currentRound.summary.map((line) => (
            <div key={line} className={`${listRowClass} text-slate-300`}>
              {line}
            </div>
          ))}
        </div>
        <div className="space-y-3">
          {players.map((player, index) => (
            <div className={listRowClass} key={player.id}>
              <span className="text-sm font-medium text-slate-50">
                #{index + 1} {player.name}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-emerald-300">
                  +{currentRound.scoreDelta[player.id] ?? 0}
                </span>
                <strong className="text-base text-slate-50">{lobby.game?.scores[player.id] ?? 0}</strong>
              </div>
            </div>
          ))}
        </div>
        {lobby.game?.phase === 'finished' ? (
          <div className="flex flex-wrap gap-3">
            <span className={pillClass}>Match complete</span>
            <button
              className={primaryButtonClass}
              disabled={!isHost || busyAction === 'reset'}
              onClick={onReset}
            >
              Play again
            </button>
          </div>
        ) : (
          <button
            className={primaryButtonClass}
            disabled={!isHost || busyAction === 'next-round'}
            onClick={onNextRound}
          >
            Next round
          </button>
        )}
      </div>
    </Surface>
  );
}
