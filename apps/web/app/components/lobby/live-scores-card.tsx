import { Surface } from '@decoy/ui';
import type { LobbyState, Player } from '@decoy/types';
import { eyebrowClass, listRowClass, panelClass, secondaryButtonClass } from '../../lib/ui';

type LiveScoresCardProps = {
  busyAction: string | null;
  isHost: boolean;
  lobby: LobbyState;
  players: Player[];
  onReset: () => void;
};

export function LiveScoresCard({
  busyAction,
  isHost,
  lobby,
  onReset,
  players
}: LiveScoresCardProps) {
  return (
    <Surface>
      <div className={panelClass}>
        <p className={eyebrowClass}>Live scores</p>
        <div className="space-y-3">
          {players.map((player, index) => (
            <div className={listRowClass} key={player.id}>
              <span className="text-sm font-medium text-slate-50">
                #{index + 1} {player.name}
              </span>
              <strong className="text-base text-slate-50">{lobby.game?.scores[player.id] ?? 0}</strong>
            </div>
          ))}
        </div>
        <button
          className={secondaryButtonClass}
          disabled={!isHost || busyAction === 'reset'}
          onClick={onReset}
        >
          Reset lobby
        </button>
      </div>
    </Surface>
  );
}
