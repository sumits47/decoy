import { Surface } from '@decoy/ui';
import type { LobbyState } from '@decoy/types';
import { eyebrowClass, listRowClass, panelClass, pillClass } from '../../lib/ui';

type PlayerListCardProps = {
  lobby: LobbyState;
  playerId: string | null;
};

export function PlayerListCard({ lobby, playerId }: PlayerListCardProps) {
  return (
    <Surface>
      <div className={panelClass}>
        <div className="space-y-4">
          <p className={eyebrowClass}>Players</p>
          <div className="space-y-3">
            {lobby.players.map((player) => (
              <div key={player.id} className={listRowClass}>
                <span className="text-sm font-medium text-slate-50">{player.name}</span>
                <div className="flex flex-wrap gap-2">
                  {player.id === playerId ? <span className={pillClass}>You</span> : null}
                  {player.isHost ? <span className={pillClass}>Host</span> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Surface>
  );
}
