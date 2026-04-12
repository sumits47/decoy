import { Surface } from '@decoy/ui';
import { allSubmissionsComplete } from '@decoy/game-engine';
import type { LobbyState, Player, RoundState } from '@decoy/types';
import {
  cardInsetClass,
  eyebrowClass,
  listRowClass,
  mutedTextClass,
  panelClass,
  pillClass,
  primaryButtonClass,
  secondaryButtonClass,
  textareaClass
} from '../../lib/ui';

type SubmissionPhaseCardProps = {
  busyAction: string | null;
  currentRound: RoundState;
  draft: string;
  effectiveSubmittedText: string;
  hasSubmittedAnswer: boolean;
  isHost: boolean;
  me: Player | null;
  players: Player[];
  onDraftChange: (draft: string) => void;
  onOpenVoting: () => void;
  onSubmitAnswer: () => void;
};

export function SubmissionPhaseCard({
  busyAction,
  currentRound,
  draft,
  effectiveSubmittedText,
  hasSubmittedAnswer,
  isHost,
  me,
  onDraftChange,
  onOpenVoting,
  onSubmitAnswer,
  players
}: SubmissionPhaseCardProps) {
  return (
    <Surface>
      <div className={panelClass}>
        <p className={eyebrowClass}>Submission phase</p>
        {me ? (
          <div className={`${cardInsetClass} space-y-3`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <strong className="text-base text-slate-50">{me.name}</strong>
              <span className={pillClass}>
                {hasSubmittedAnswer ? 'Submitted' : draft.trim() ? 'Draft ready' : 'Waiting'}
              </span>
            </div>
            {hasSubmittedAnswer ? (
              <>
                <p className={mutedTextClass}>Your answer is locked in.</p>
                <div className="rounded-2xl bg-slate-950/40 px-4 py-3 text-sm text-slate-200">
                  {effectiveSubmittedText}
                </div>
              </>
            ) : (
              <>
                <textarea
                  className={textareaClass}
                  rows={3}
                  value={draft}
                  onChange={(event) => onDraftChange(event.target.value)}
                  placeholder={
                    currentRound.archetype === 'bluff_trivia'
                      ? 'Enter a convincing fake answer'
                      : 'Enter your funniest answer'
                  }
                />
                <button
                  className={secondaryButtonClass}
                  disabled={busyAction === 'submit'}
                  onClick={onSubmitAnswer}
                >
                  Submit my answer
                </button>
              </>
            )}
          </div>
        ) : (
          <p className={mutedTextClass}>Join this lobby on this browser to submit an answer.</p>
        )}
        <div className="space-y-3">
          {players.map((player) => {
            const submitted = Boolean(
              currentRound.submissions.find((submission) => submission.playerId === player.id)?.text.trim()
            );

            return (
              <div key={player.id} className={listRowClass}>
                <span className="text-sm font-medium text-slate-50">{player.name}</span>
                <span className={pillClass}>{submitted ? 'Submitted' : 'Waiting'}</span>
              </div>
            );
          })}
        </div>
        <button
          className={primaryButtonClass}
          disabled={!isHost || !allSubmissionsComplete(currentRound) || busyAction === 'open-voting'}
          onClick={onOpenVoting}
        >
          Lock answers and open voting
        </button>
      </div>
    </Surface>
  );
}
