-- CreateEnum
CREATE TYPE "LobbyStatus" AS ENUM ('OPEN', 'IN_GAME', 'FINISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('HOST', 'PLAYER', 'SPECTATOR');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'LEFT', 'KICKED');

-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'FINISHED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "RoundArchetype" AS ENUM ('BLUFF_TRIVIA', 'OPINION_VOTE');

-- CreateEnum
CREATE TYPE "ResolutionType" AS ENUM ('CORRECT_ANSWER', 'AUDIENCE_VOTE');

-- CreateEnum
CREATE TYPE "RoundPhase" AS ENUM ('SUBMISSION', 'VOTING', 'REVEAL', 'COMPLETE');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('DRAFT', 'LOCKED');

-- CreateEnum
CREATE TYPE "VoteKind" AS ENUM ('ROUND_OPTION');

-- CreateEnum
CREATE TYPE "ScoreEventType" AS ENUM ('TRUTH_GUESSED', 'DECOY_FOOLED', 'AUDIENCE_VOTE', 'CROWD_BONUS', 'MANUAL_ADJUSTMENT');

-- CreateTable
CREATE TABLE "Lobby" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(8) NOT NULL,
    "hostPlayerId" TEXT NOT NULL,
    "status" "LobbyStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "stateJson" JSONB NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "Lobby_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "displayName" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerSession" (
    "token" VARCHAR(191) NOT NULL,
    "lobbyCode" VARCHAR(8) NOT NULL,
    "playerId" TEXT NOT NULL,
    "playerName" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerSession_pkey" PRIMARY KEY ("token")
);

-- CreateTable
CREATE TABLE "LobbyMembership" (
    "id" TEXT NOT NULL,
    "lobbyId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL DEFAULT 'PLAYER',
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "sessionTokenHash" VARCHAR(191) NOT NULL,
    "sessionTokenPreview" VARCHAR(24),

    CONSTRAINT "LobbyMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "lobbyId" TEXT NOT NULL,
    "status" "GameStatus" NOT NULL DEFAULT 'DRAFT',
    "roundIndex" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Round" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "archetype" "RoundArchetype" NOT NULL,
    "resolutionType" "ResolutionType" NOT NULL,
    "phase" "RoundPhase" NOT NULL DEFAULT 'SUBMISSION',
    "promptId" VARCHAR(64),
    "promptCategory" VARCHAR(128),
    "promptText" TEXT NOT NULL,
    "canonicalAnswer" TEXT,
    "votePrompt" TEXT,
    "scoreSummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "revealedAt" TIMESTAMP(3),

    CONSTRAINT "Round_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lockedAt" TIMESTAMP(3),

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoundOption" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "submissionId" TEXT,
    "ownerPlayerId" TEXT,
    "text" TEXT NOT NULL,
    "isTruth" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoundOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "voterPlayerId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "kind" "VoteKind" NOT NULL DEFAULT 'ROUND_OPTION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreEvent" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "roundId" TEXT,
    "playerId" TEXT NOT NULL,
    "sourcePlayerId" TEXT,
    "type" "ScoreEventType" NOT NULL,
    "points" INTEGER NOT NULL,
    "summary" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lobby_code_key" ON "Lobby"("code");

-- CreateIndex
CREATE INDEX "Lobby_status_createdAt_idx" ON "Lobby"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PlayerSession_lobbyCode_createdAt_idx" ON "PlayerSession"("lobbyCode", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerSession_lobbyCode_playerId_key" ON "PlayerSession"("lobbyCode", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "LobbyMembership_sessionTokenHash_key" ON "LobbyMembership"("sessionTokenHash");

-- CreateIndex
CREATE INDEX "LobbyMembership_lobbyId_status_idx" ON "LobbyMembership"("lobbyId", "status");

-- CreateIndex
CREATE INDEX "LobbyMembership_playerId_status_idx" ON "LobbyMembership"("playerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LobbyMembership_lobbyId_playerId_key" ON "LobbyMembership"("lobbyId", "playerId");

-- CreateIndex
CREATE INDEX "Game_lobbyId_createdAt_idx" ON "Game"("lobbyId", "createdAt");

-- CreateIndex
CREATE INDEX "Round_gameId_phase_idx" ON "Round"("gameId", "phase");

-- CreateIndex
CREATE UNIQUE INDEX "Round_gameId_roundNumber_key" ON "Round"("gameId", "roundNumber");

-- CreateIndex
CREATE INDEX "Submission_roundId_status_idx" ON "Submission"("roundId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_roundId_playerId_key" ON "Submission"("roundId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "RoundOption_submissionId_key" ON "RoundOption"("submissionId");

-- CreateIndex
CREATE INDEX "RoundOption_roundId_displayOrder_idx" ON "RoundOption"("roundId", "displayOrder");

-- CreateIndex
CREATE INDEX "RoundOption_roundId_ownerPlayerId_idx" ON "RoundOption"("roundId", "ownerPlayerId");

-- CreateIndex
CREATE INDEX "Vote_roundId_optionId_idx" ON "Vote"("roundId", "optionId");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_roundId_voterPlayerId_key" ON "Vote"("roundId", "voterPlayerId");

-- CreateIndex
CREATE INDEX "ScoreEvent_gameId_createdAt_idx" ON "ScoreEvent"("gameId", "createdAt");

-- CreateIndex
CREATE INDEX "ScoreEvent_playerId_createdAt_idx" ON "ScoreEvent"("playerId", "createdAt");

-- CreateIndex
CREATE INDEX "ScoreEvent_roundId_createdAt_idx" ON "ScoreEvent"("roundId", "createdAt");

-- AddForeignKey
ALTER TABLE "PlayerSession" ADD CONSTRAINT "PlayerSession_lobbyCode_fkey" FOREIGN KEY ("lobbyCode") REFERENCES "Lobby"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LobbyMembership" ADD CONSTRAINT "LobbyMembership_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "Lobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LobbyMembership" ADD CONSTRAINT "LobbyMembership_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "Lobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundOption" ADD CONSTRAINT "RoundOption_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundOption" ADD CONSTRAINT "RoundOption_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundOption" ADD CONSTRAINT "RoundOption_ownerPlayerId_fkey" FOREIGN KEY ("ownerPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_voterPlayerId_fkey" FOREIGN KEY ("voterPlayerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "RoundOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreEvent" ADD CONSTRAINT "ScoreEvent_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreEvent" ADD CONSTRAINT "ScoreEvent_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreEvent" ADD CONSTRAINT "ScoreEvent_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

