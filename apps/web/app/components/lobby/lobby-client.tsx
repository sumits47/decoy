'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ROUND_COUNT_OPTIONS } from '@decoy/game-engine';
import type { DeckDefinition, LobbyMembership, LobbyState, Player, RoundCount } from '@decoy/types';
import { useLobby } from '../../hooks/use-lobby';
import {
  DECKS,
  api,
  currentRoundFor,
  deckFor,
  getStoredMembership,
  scoreRows
} from '../../lib/lobby-client';
import {
  errorTextClass,
  mutedTextClass,
  pageSectionClass,
  shellClass
} from '../../lib/ui';
import { DeckBrowser } from './deck-browser';
import { DeckSetupCard } from './deck-setup-card';
import { LiveScoresCard } from './live-scores-card';
import { LobbyLoadingState } from './lobby-loading-state';
import { LobbyNotFoundState } from './lobby-not-found-state';
import { LobbySetupCard } from './lobby-setup-card';
import { PlayerListCard } from './player-list-card';
import { RevealPhaseCard } from './reveal-phase-card';
import { RoomHeader } from './room-header';
import { RoundOverviewCard } from './round-overview-card';
import { SubmissionPhaseCard } from './submission-phase-card';
import { VotingPhaseCard } from './voting-phase-card';

type LobbyClientProps = {
  code: string;
  screen?: 'lobby' | 'decks';
};

export function LobbyClient({ code, screen = 'lobby' }: LobbyClientProps) {
  const normalizedCode = code.toUpperCase();
  const { lobby, loading, error, refresh, setLobby } = useLobby(normalizedCode);
  const [membership, setMembership] = useState<LobbyMembership | null>(null);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [optimisticSubmission, setOptimisticSubmission] = useState<{
    key: string;
    text: string;
  } | null>(null);
  const [optimisticVote, setOptimisticVote] = useState<{
    key: string;
    optionId: string;
  } | null>(null);

  useEffect(() => {
    setMembership(getStoredMembership(normalizedCode));
  }, [normalizedCode]);

  const playerId = membership?.playerId ?? null;
  const me = useMemo(
    () => lobby?.players.find((player) => player.id === playerId) ?? null,
    [lobby, playerId]
  );
  const isHost = Boolean(me && lobby && me.id === lobby.hostPlayerId);
  const selectedDeck = useMemo(
    () => deckFor(lobby?.game?.deckId ?? lobby?.config.deckId ?? DECKS[0].id),
    [lobby]
  );
  const selectedRoundCount = lobby?.game?.roundCount ?? lobby?.config.roundCount ?? ROUND_COUNT_OPTIONS[0];
  const deckBrowserHref = `/lobby/${normalizedCode}/decks`;
  const lobbyHref = `/lobby/${normalizedCode}`;
  const currentRound = currentRoundFor(lobby);
  const draftRoundKey = useMemo(() => {
    if (!lobby?.game || !currentRound || !playerId) return null;
    return `${lobby.game.id}:${lobby.game.roundIndex}:${currentRound.phase}:${playerId}`;
  }, [currentRound, lobby?.game, playerId]);
  const existingSubmission = useMemo(() => {
    if (!currentRound || !playerId) return '';
    return currentRound.submissions.find((submission) => submission.playerId === playerId)?.text ?? '';
  }, [currentRound, playerId]);
  const sortedScores = useMemo(() => {
    if (!lobby?.game) return [];
    return scoreRows(lobby.game.players, lobby.game.scores);
  }, [lobby]);
  const submissionKey = useMemo(() => {
    if (!lobby?.game || !currentRound || !playerId || currentRound.phase !== 'submission') return null;
    return `${lobby.game.id}:${lobby.game.roundIndex}:submission:${playerId}`;
  }, [currentRound, lobby?.game, playerId]);
  const effectiveSubmittedText =
    submissionKey && optimisticSubmission?.key === submissionKey
      ? optimisticSubmission.text
      : existingSubmission;
  const hasSubmittedAnswer = Boolean(effectiveSubmittedText.trim());
  const votingKey = useMemo(() => {
    if (!lobby?.game || !currentRound || !playerId || currentRound.phase !== 'voting') return null;
    return `${lobby.game.id}:${lobby.game.roundIndex}:voting:${playerId}`;
  }, [currentRound, lobby?.game, playerId]);
  const effectiveVoteOptionId =
    votingKey && optimisticVote?.key === votingKey
      ? optimisticVote.optionId
      : playerId
        ? currentRound?.votes[playerId] ?? null
        : null;

  useEffect(() => {
    setDraft(existingSubmission);
  }, [draftRoundKey, existingSubmission]);

  const runAction = useCallback(
    async (action: string, path: string, body: Record<string, string> = {}) => {
      if (!membership?.playerSessionToken) {
        setStatus('Join this lobby from this browser first.');
        return false;
      }

      setBusyAction(action);
      setStatus(null);

      try {
        const data = await api<{ lobby?: LobbyState }>(path, {
          method: 'POST',
          body: JSON.stringify({ ...body, playerSessionToken: membership.playerSessionToken })
        });

        if (data.lobby) {
          setLobby(data.lobby);
        } else {
          await refresh();
        }

        return true;
      } catch (nextError) {
        setStatus(nextError instanceof Error ? nextError.message : 'Action failed.');
        return false;
      } finally {
        setBusyAction(null);
      }
    },
    [membership, refresh, setLobby]
  );

  const submitCurrentAnswer = useCallback(async () => {
    if (!lobby || !submissionKey) return;

    const text = draft.trim();
    if (!text) {
      setStatus('Enter an answer first.');
      return;
    }

    setOptimisticSubmission({ key: submissionKey, text });
    const succeeded = await runAction('submit', `/api/lobbies/${lobby.code}/submit`, { text });
    if (!succeeded) {
      setOptimisticSubmission((current) => (current?.key === submissionKey ? null : current));
    }
  }, [draft, lobby, runAction, submissionKey]);

  const submitVoteChoice = useCallback(
    async (optionId: string) => {
      if (!lobby || !votingKey) return;

      setOptimisticVote({ key: votingKey, optionId });
      const succeeded = await runAction('vote', `/api/lobbies/${lobby.code}/vote`, { optionId });
      if (!succeeded) {
        setOptimisticVote((current) =>
          current?.key === votingKey && current.optionId === optionId ? null : current
        );
      }
    },
    [lobby, runAction, votingKey]
  );

  const updateSettings = useCallback(
    async (nextDeckId?: DeckDefinition['id'], nextRoundCount?: RoundCount) => {
      if (!lobby) return;

      const deckId = nextDeckId ?? lobby.config.deckId;
      const roundCount = nextRoundCount ?? lobby.config.roundCount;

      await runAction('settings', `/api/lobbies/${lobby.code}/settings`, {
        deckId,
        roundCount: String(roundCount)
      });
    },
    [lobby, runAction]
  );

  if (loading) {
    return <LobbyLoadingState />;
  }

  if (!lobby) {
    return <LobbyNotFoundState error={error} onRetry={() => void refresh()} />;
  }

  return (
    <main className={shellClass}>
      <div className={pageSectionClass}>
        <RoomHeader code={lobby.code} isHost={isHost} playerName={me?.name} />

        {status ? <p className={errorTextClass}>{status}</p> : null}
        {error ? <p className={mutedTextClass}>Refresh issue: {error}</p> : null}

        {!lobby.game ? (
          screen === 'decks' ? (
            <DeckBrowser
              busyAction={busyAction}
              isHost={isHost}
              lobby={lobby}
              lobbyHref={lobbyHref}
              selectedDeck={selectedDeck}
              selectedRoundCount={selectedRoundCount}
              onUpdateDeck={(deckId) => void updateSettings(deckId)}
            />
          ) : (
            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
              <div className="space-y-5">
                <PlayerListCard lobby={lobby} playerId={playerId} />
                <LobbySetupCard
                  busyAction={busyAction}
                  isHost={isHost}
                  lobby={lobby}
                  playerReady={Boolean(me)}
                  onStart={() => void runAction('start', `/api/lobbies/${lobby.code}/start`)}
                  onUpdateRoundCount={(count) => void updateSettings(undefined, count)}
                />
              </div>
              <DeckSetupCard
                deckBrowserHref={deckBrowserHref}
                selectedDeck={selectedDeck}
                selectedRoundCount={selectedRoundCount}
              />
            </div>
          )
        ) : currentRound ? (
          <div className="grid gap-5 lg:grid-cols-2">
            <RoundOverviewCard lobby={lobby} round={currentRound} />
            <LiveScoresCard
              busyAction={busyAction}
              isHost={isHost}
              lobby={lobby}
              players={sortedScores}
              onReset={() => void runAction('reset', `/api/lobbies/${lobby.code}/reset`)}
            />

            {currentRound.phase === 'submission' ? (
              <div className="lg:col-span-2">
                <SubmissionPhaseCard
                  busyAction={busyAction}
                  currentRound={currentRound}
                  draft={draft}
                  effectiveSubmittedText={effectiveSubmittedText}
                  hasSubmittedAnswer={hasSubmittedAnswer}
                  isHost={isHost}
                  me={me}
                  players={lobby.game.players}
                  onDraftChange={setDraft}
                  onOpenVoting={() =>
                    void runAction('open-voting', `/api/lobbies/${lobby.code}/open-voting`)
                  }
                  onSubmitAnswer={() => void submitCurrentAnswer()}
                />
              </div>
            ) : null}

            {currentRound.phase === 'voting' ? (
              <div className="lg:col-span-2">
                <VotingPhaseCard
                  busyAction={busyAction}
                  currentRound={currentRound}
                  effectiveVoteOptionId={effectiveVoteOptionId}
                  isHost={isHost}
                  me={me}
                  players={lobby.game.players}
                  onReveal={() => void runAction('reveal', `/api/lobbies/${lobby.code}/reveal`)}
                  onVote={(optionId) => void submitVoteChoice(optionId)}
                />
              </div>
            ) : null}

            {currentRound.phase === 'reveal' ? (
              <div className="lg:col-span-2">
                <RevealPhaseCard
                  busyAction={busyAction}
                  currentRound={currentRound}
                  isHost={isHost}
                  lobby={lobby}
                  players={scoreRows(lobby.game.players, lobby.game.scores)}
                  onNextRound={() =>
                    void runAction('next-round', `/api/lobbies/${lobby.code}/next-round`)
                  }
                  onReset={() => void runAction('reset', `/api/lobbies/${lobby.code}/reset`)}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </main>
  );
}
