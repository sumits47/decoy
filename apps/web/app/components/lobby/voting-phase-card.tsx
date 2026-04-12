import { Surface } from '@decoy/ui';
import { allVotesComplete } from '@decoy/game-engine';
import type { LobbyState, Player, RoundState } from '@decoy/types';
import { cn } from '../../lib/cn';
import {
  cardInsetClass,
  eyebrowClass,
  listRowClass,
  mutedTextClass,
  panelClass,
  pillClass,
  primaryButtonClass
} from '../../lib/ui';

type VotingPhaseCardProps = {
  busyAction: string | null;
  currentRound: RoundState;
  effectiveVoteOptionId: string | null;
  isHost: boolean;
  me: Player | null;
  players: Player[];
  onReveal: () => void;
  onVote: (optionId: string) => void;
};

export function VotingPhaseCard({
  busyAction,
  currentRound,
  effectiveVoteOptionId,
  isHost,
  me,
  onReveal,
  onVote,
  players
}: VotingPhaseCardProps) {
  return (
    <Surface>
      <div className={panelClass}>
        <p className={eyebrowClass}>Voting phase</p>
        {me ? (
          <div className={`${cardInsetClass} space-y-3`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <strong className="text-base text-slate-50">{me.name}</strong>
              <span className={pillClass}>{effectiveVoteOptionId ? 'Voted' : 'Choose one'}</span>
            </div>
            {effectiveVoteOptionId ? (
              <p className={mutedTextClass}>Your vote is locked in.</p>
            ) : null}
            <div className="space-y-2">
              {currentRound.options.map((option) => {
                const disabled = Boolean(
                  option.ownerPlayerId === me.id || effectiveVoteOptionId || busyAction === 'vote'
                );

                return (
                  <button
                    key={option.id}
                    className={cn(
                      'vote-option flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition',
                      effectiveVoteOptionId === option.id
                        ? 'border-fuchsia-300/70 bg-fuchsia-400/15 text-slate-50'
                        : 'border-white/12 bg-white/5 text-slate-100 hover:bg-white/10',
                      disabled ? 'cursor-not-allowed opacity-70' : ''
                    )}
                    onClick={() => onVote(option.id)}
                    disabled={disabled}
                  >
                    <span>{option.text}</span>
                    {option.ownerPlayerId === me.id ? (
                      <span className="text-xs uppercase tracking-[0.16em] text-slate-400">
                        Your answer
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <p className={mutedTextClass}>Join this lobby on this browser to vote.</p>
        )}
        <div className="space-y-3">
          {players.map((player) => (
            <div key={player.id} className={listRowClass}>
              <span className="text-sm font-medium text-slate-50">{player.name}</span>
              <span className={pillClass}>{currentRound.votes[player.id] ? 'Voted' : 'Waiting'}</span>
            </div>
          ))}
        </div>
        <button
          className={primaryButtonClass}
          disabled={!isHost || !allVotesComplete(currentRound, players) || busyAction === 'reveal'}
          onClick={onReveal}
        >
          Reveal round results
        </button>
      </div>
    </Surface>
  );
}
