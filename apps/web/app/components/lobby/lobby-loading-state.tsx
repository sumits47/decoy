import { Surface } from '@decoy/ui';
import { eyebrowClass, mutedTextClass, narrowPageSectionClass, panelClass, sectionTitleClass, shellClass } from '../../lib/ui';

export function LobbyLoadingState() {
  return (
    <main className={shellClass}>
      <div className={narrowPageSectionClass}>
        <Surface>
          <div className={`${panelClass} min-h-72 justify-center`}>
            <p className={eyebrowClass}>Loading lobby</p>
            <h1 className={sectionTitleClass}>Reconnecting the room</h1>
            <p className={mutedTextClass}>Pulling the latest snapshot and waiting for realtime updates.</p>
          </div>
        </Surface>
      </div>
    </main>
  );
}
