'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Surface } from '@decoy/ui';
import {
  badgeClass,
  heroSectionClass,
  inputClass,
  labelClass,
  leadClass,
  panelClass,
  primaryButtonClass,
  secondaryButtonClass,
  shellClass
} from '../lib/ui';

export function LandingClient() {
  const [hostName, setHostName] = useState('Sumit');
  const [joinCode, setJoinCode] = useState('');

  return (
    <main className={shellClass}>
      <section className={heroSectionClass}>
        <div className="max-w-3xl space-y-5">
          <img className="h-auto w-full max-w-[540px]" src="/branding/decoy-logo.svg" alt="Decoy" />
          <span className={badgeClass}>Web-first social bluffing party game</span>
          <h1 className="max-w-4xl text-5xl font-semibold tracking-[-0.06em] text-slate-50 md:text-7xl">
            One fake answer. Everybody hunting for it.
          </h1>
          <p className={leadClass}>
            Create a room, pick a themed deck, lock in five, seven, or ten rounds, and let the room bluff in realtime.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <Surface>
            <div className={panelClass}>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300/90">
                Create lobby
              </p>
              <label className={labelClass}>
                <span>Host name</span>
                <input
                  className={inputClass}
                  value={hostName}
                  onChange={(event) => setHostName(event.target.value)}
                  placeholder="Host name"
                />
              </label>
              <Link
                className={primaryButtonClass}
                href={`/create?host=${encodeURIComponent(hostName || 'Host')}`}
              >
                Create lobby
              </Link>
            </div>
          </Surface>

          <Surface>
            <div className={panelClass}>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300/90">
                Join lobby
              </p>
              <label className={labelClass}>
                <span>Room code</span>
                <input
                  className={inputClass}
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                  placeholder="ABCD"
                  maxLength={4}
                />
              </label>
              <Link
                className={secondaryButtonClass}
                href={`/join?code=${encodeURIComponent(joinCode)}`}
              >
                Join by code
              </Link>
            </div>
          </Surface>
        </div>
      </section>
    </main>
  );
}
