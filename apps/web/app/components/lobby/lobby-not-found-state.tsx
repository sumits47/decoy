import Link from 'next/link';
import { Surface } from '@decoy/ui';
import {
  mutedTextClass,
  narrowPageSectionClass,
  panelClass,
  primaryButtonClass,
  secondaryButtonClass,
  sectionTitleClass,
  shellClass
} from '../../lib/ui';

type LobbyNotFoundStateProps = {
  error: string | null;
  onRetry: () => void;
};

export function LobbyNotFoundState({ error, onRetry }: LobbyNotFoundStateProps) {
  return (
    <main className={shellClass}>
      <div className={narrowPageSectionClass}>
        <Surface>
          <div className={panelClass}>
            <h1 className={sectionTitleClass}>Lobby not found</h1>
            <p className={mutedTextClass}>{error ?? 'That room code does not exist on the server.'}</p>
            <div className="flex flex-wrap gap-3">
              <Link className={primaryButtonClass} href="/">
                Go home
              </Link>
              <button className={secondaryButtonClass} onClick={onRetry}>
                Retry
              </button>
            </div>
          </div>
        </Surface>
      </div>
    </main>
  );
}
