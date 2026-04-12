import type { ReactNode } from 'react';
import type { DeckDefinition } from '@decoy/types';
import { cn } from '../lib/cn';
import { DeckTypePill } from './deck-type-pill';

type DeckCardProps = {
  deck: DeckDefinition;
  active: boolean;
  disabled?: boolean;
  footer?: ReactNode;
  imageTestId?: string;
  onClick?: () => void;
  showSelectedBadge?: boolean;
};

export function DeckCard({
  deck,
  active,
  disabled,
  footer,
  imageTestId,
  onClick,
  showSelectedBadge = active
}: DeckCardProps) {
  const content = (
    <>
      <div className="grid gap-4 sm:grid-cols-[108px_minmax(0,1fr)] sm:items-center">
        <img
          className="aspect-square w-full rounded-3xl border border-white/10 bg-white/5 object-cover"
          src={deck.imagePath}
          alt={imageTestId ? deck.name : ''}
          aria-hidden={imageTestId ? undefined : true}
          data-testid={imageTestId}
        />
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong className="block text-lg font-semibold leading-tight text-slate-50">
              {deck.name}
            </strong>
            {showSelectedBadge ? (
              <span className="inline-flex items-center rounded-full bg-cyan-300/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100">
                Selected
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <DeckTypePill archetype={deck.archetype} />
            {deck.isAdult ? (
              <span className="inline-flex items-center rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-sm text-slate-200">
                Adult
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-300">{deck.description}</p>
      {footer ? <div className="mt-4">{footer}</div> : null}
    </>
  );

  const cardClassName = cn(
    'deck-card rounded-[28px] border p-4 text-left transition duration-150',
    active
      ? 'border-cyan-300/50 bg-gradient-to-b from-cyan-300/12 via-fuchsia-500/10 to-white/[0.04] shadow-[inset_0_0_0_1px_rgba(34,211,238,0.14)]'
      : 'border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.03]',
    onClick ? 'deck-card-button hover:-translate-y-px disabled:translate-y-0 disabled:opacity-50' : ''
  );

  if (!onClick) {
    return <div className={cardClassName}>{content}</div>;
  }

  return (
    <button
      type="button"
      className={cardClassName}
      data-testid={`deck-card-${deck.id}`}
      disabled={disabled}
      onClick={onClick}
    >
      {content}
    </button>
  );
}
