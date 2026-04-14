'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Surface } from '@decoy/ui';
import type { LobbyMembership, Player } from '@decoy/types';
import { api, getStoredMembership, storeMembership } from '../lib/lobby-client';
import {
  eyebrowClass,
  errorTextClass,
  inputClass,
  labelClass,
  mutedTextClass,
  narrowPageSectionClass,
  panelClass,
  primaryButtonClass,
  secondaryButtonClass,
  shellClass
} from '../lib/ui';

export function JoinLobbyClient({ initialCode }: { initialCode: string }) {
  const [code, setCode] = useState(initialCode.toUpperCase());
  const [name, setName] = useState('');
  const membership = useMemo(() => getStoredMembership(code), [code]);
  const [status, setStatus] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const joinInFlightRef = useRef(false);

  useEffect(() => {
    if (membership?.playerName) {
      setName((current) => current || membership.playerName);
    }
  }, [membership]);

  const join = async () => {
    if (joinInFlightRef.current) return;

    joinInFlightRef.current = true;
    setJoining(true);
    setStatus(null);

    try {
      const data = await api<{ player: Player; membership: LobbyMembership }>(
        `/api/lobbies/${code}/join`,
        {
          method: 'POST',
          body: JSON.stringify({ name, playerSessionToken: membership?.playerSessionToken })
        }
      );
      storeMembership(data.membership);
      window.location.href = `/lobby/${code.toUpperCase()}`;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to join lobby.');
    } finally {
      joinInFlightRef.current = false;
      setJoining(false);
    }
  };

  return (
    <main className={shellClass}>
      <div className={narrowPageSectionClass}>
        <Surface>
          <div className={panelClass}>
            <p className={eyebrowClass}>Join lobby</p>
            <label className={labelClass}>
              <span>Room code</span>
              <input
                className={inputClass}
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                maxLength={4}
              />
            </label>
            <label className={labelClass}>
              <span>Your name</span>
              <input
                className={inputClass}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={membership?.playerName ?? 'Riya'}
              />
            </label>
            {membership ? (
              <p className={mutedTextClass}>
                This browser will resume its existing seat for room {code || '----'}.
              </p>
            ) : null}
            {status ? <p className={errorTextClass}>{status}</p> : null}
            <div className="flex flex-wrap gap-3">
              <button className={primaryButtonClass} onClick={join} disabled={joining}>
                Join lobby
              </button>
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
