'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Surface } from '@decoy/ui';
import type { LobbyMembership, LobbyState, Player } from '@decoy/types';
import { api, storeMembership } from '../lib/lobby-client';
import {
  eyebrowClass,
  errorTextClass,
  mutedTextClass,
  narrowPageSectionClass,
  panelClass,
  primaryButtonClass,
  secondaryButtonClass,
  sectionTitleClass,
  shellClass
} from '../lib/ui';

export function CreateLobbyClient({ hostName }: { hostName: string }) {
  const [createdLobbyCode, setCreatedLobbyCode] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const create = async () => {
      try {
        const data = await api<{ lobby: LobbyState; player: Player; membership: LobbyMembership }>(
          '/api/lobbies',
          {
            method: 'POST',
            body: JSON.stringify({ hostName })
          }
        );
        storeMembership(data.membership);
        if (!cancelled) {
          setCreatedLobbyCode(data.lobby.code);
        }
      } catch (error) {
        if (!cancelled) {
          setStatus(error instanceof Error ? error.message : 'Unable to create lobby.');
        }
      }
    };

    void create();
    return () => {
      cancelled = true;
    };
  }, [hostName]);

  if (status) {
    return (
      <main className={shellClass}>
        <div className={narrowPageSectionClass}>
          <Surface>
            <div className={panelClass}>
              <h1 className={sectionTitleClass}>Couldn’t create lobby</h1>
              <p className={errorTextClass}>{status}</p>
              <Link className={secondaryButtonClass} href="/">
                Back home
              </Link>
            </div>
          </Surface>
        </div>
      </main>
    );
  }

  if (!createdLobbyCode) {
    return (
      <main className={shellClass}>
        <div className={narrowPageSectionClass}>
          <Surface>
            <div className={`${panelClass} min-h-80 justify-center`}>
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-3">
                <span className="loading-dot h-2.5 w-2.5 animate-[loading-pulse_1.1s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-cyan-300 to-fuchsia-500" />
                <span className="loading-dot h-2.5 w-2.5 animate-[loading-pulse_1.1s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-cyan-300 to-fuchsia-500 [animation-delay:150ms]" />
                <span className="loading-dot h-2.5 w-2.5 animate-[loading-pulse_1.1s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-cyan-300 to-fuchsia-500 [animation-delay:300ms]" />
              </div>
              <p className={eyebrowClass}>Creating lobby</p>
              <h1 className={sectionTitleClass}>Setting up your room</h1>
              <p className={mutedTextClass}>
                Reserving a code for <strong>{hostName || 'Host'}</strong> and preparing the first browser session.
              </p>
            </div>
          </Surface>
        </div>
      </main>
    );
  }

  return (
    <main className={shellClass}>
      <div className={narrowPageSectionClass}>
        <Surface>
          <div className={panelClass}>
            <p className={eyebrowClass}>Lobby created</p>
            <h1 className={sectionTitleClass}>Room code {createdLobbyCode}</h1>
            <p className={mutedTextClass}>
              Share the code. Everyone can join from their own browser now.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link className={primaryButtonClass} href={`/lobby/${createdLobbyCode}`}>
                Open lobby
              </Link>
              <Link className={secondaryButtonClass} href="/">
                Back home
              </Link>
            </div>
          </div>
        </Surface>
      </div>
    </main>
  );
}
