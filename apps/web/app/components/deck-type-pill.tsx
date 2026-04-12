import type { DeckDefinition } from '@decoy/types';
import { deckArchetypeLabel } from '../lib/lobby-client';

function DeckTypeIcon({ archetype }: { archetype: DeckDefinition['archetype'] }) {
  if (archetype === 'bluff_trivia') {
    return (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-3.5 w-3.5">
        <path
          d="M5.5 4.75h9a1.75 1.75 0 0 1 1.75 1.75v7a1.75 1.75 0 0 1-1.75 1.75h-9A1.75 1.75 0 0 1 3.75 13.5v-7A1.75 1.75 0 0 1 5.5 4.75Z"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M7 8.25h6M7 11.25h3.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="13.75" cy="11.25" r="0.75" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-3.5 w-3.5">
      <path
        d="M10 16.25c3.452 0 6.25-2.35 6.25-5.25S13.452 5.75 10 5.75 3.75 8.1 3.75 11c0 1.378.637 2.632 1.68 3.568.23.205.36.498.34.806l-.098 1.48 1.783-.9c.23-.117.495-.145.748-.08.565.146 1.167.226 1.797.226Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="7.5" cy="11" r="0.9" fill="currentColor" />
      <circle cx="10" cy="11" r="0.9" fill="currentColor" />
      <circle cx="12.5" cy="11" r="0.9" fill="currentColor" />
    </svg>
  );
}

export function DeckTypePill({ archetype }: { archetype: DeckDefinition['archetype'] }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-gradient-to-r from-cyan-400/15 to-fuchsia-500/15 px-3 py-1.5 text-sm font-semibold text-cyan-50">
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-950/50 text-cyan-100">
        <DeckTypeIcon archetype={archetype} />
      </span>
      {deckArchetypeLabel(archetype)}
    </span>
  );
}
