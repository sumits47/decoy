import Link from 'next/link';
import { badgeClass, eyebrowClass, pillClass, secondaryButtonClass } from '../../lib/ui';

type RoomHeaderProps = {
  code: string;
  isHost: boolean;
  playerName?: string | null;
};

export function RoomHeader({ code, isHost, playerName }: RoomHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <span className={badgeClass}>Room {code}</span>
          {playerName ? <span className={pillClass}>You: {playerName}</span> : <span className={pillClass}>Read-only view</span>}
          {isHost ? <span className={pillClass}>Host controls</span> : null}
        </div>
        <div className="space-y-2">
          <p className={eyebrowClass}>Room overview</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-50 md:text-4xl">
            Decoy lobby
          </h1>
        </div>
      </div>
      <Link className={secondaryButtonClass} href="/">
        Home
      </Link>
    </div>
  );
}
