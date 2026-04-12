# AGENTS.md

## Project Summary

Decoy is a pnpm monorepo for a web-first social bluffing party game.

Today, the working product is a playable Next.js prototype with:

- lobby creation and joining
- browser-local player session persistence
- two round archetypes: `bluff_trivia` and `opinion_vote`
- server-side round progression and scoring
- polling-based lobby refresh

The repo also includes shared packages for domain types, game rules, UI primitives, config, and Prisma-backed persistence.

## Monorepo Layout

```text
apps/
  web/                 Next.js App Router frontend and API routes
packages/
  backend/             Server-side lobby/game orchestration
  config/              Shared app metadata
  database/            Prisma client + schema
  game-engine/         Pure-ish game state helpers and scoring
  types/               Shared domain contracts
  ui/                  Small shared React UI primitives
```

## How The App Actually Works

### Frontend

- `apps/web/app/decoy-client.tsx` contains almost all client UI logic.
- The UI polls `/api/lobbies/[code]` every 2 seconds.
- Player identity is stored in `localStorage` under `decoy.player.identity.v2`.
- The main routes are:
  - `/`
  - `/create`
  - `/join`
  - `/lobby/[code]`

### API Layer

- App Router route handlers live under `apps/web/app/api/lobbies`.
- These handlers are intentionally thin and mostly delegate to `@decoy/backend`.
- There are duplicate endpoint variants:
  - preferred/current routes: `/api/lobbies`, `/api/lobbies/[code]/join`, `/start`, `/submit`, `/open-voting`, `/vote`, `/reveal`, `/next-round`, `/reset`
  - legacy/duplicate aliases also exist: `/create`, `/join`, `/submit-answer`, `/cast-vote`, `/advance-round`
- If you change request/response shapes, update every route alias or remove duplicates deliberately.

### Backend Orchestration

- `packages/backend/src/index.ts` is the main server authority.
- It:
  - loads lobby snapshots from Prisma
  - validates host/player permissions
  - applies game-engine transitions
  - writes the updated snapshot back to the database
- Errors are normalized through `LobbyError` and `toErrorResponse`.

### Game State

- `packages/game-engine/src/index.ts` contains the gameplay helpers:
  - lobby creation
  - round creation
  - answer submission
  - vote locking
  - scoring
  - round advancement
- `promptDeck` is hardcoded here right now.
- The game engine is deterministic except for ID generation, lobby code generation, and option shuffling.

### Types

- `packages/types/src/index.ts` is the shared contract between UI, backend, and engine.
- Keep these types in sync whenever you change lobby shape, round shape, or scoring fields.

### Persistence

- Prisma schema lives in `packages/database/prisma/schema.prisma`.
- Runtime code currently relies primarily on:
  - `Lobby.stateJson`
  - `PlayerSession`
- The richer normalized Prisma models exist, but most are not yet used by the live app flow.
- Treat the JSON snapshot as the current source of truth unless you are intentionally migrating persistence strategy.

## Important Files

- `README.md`: top-level project setup
- `IMPLEMENTATION_PLAN.md`: product and architecture direction
- `apps/web/app/decoy-client.tsx`: primary UI and client behavior
- `packages/backend/src/index.ts`: server orchestration
- `packages/game-engine/src/index.ts`: rules and scoring
- `packages/types/src/index.ts`: shared contracts
- `packages/database/prisma/schema.prisma`: database model
- `.env.example`: expected environment variables

## Local Commands

Run from repo root:

```bash
pnpm install
pnpm dev
pnpm build
pnpm typecheck
pnpm db:generate
```

Useful database commands:

```bash
pnpm --filter @decoy/database db:migrate:dev
pnpm --filter @decoy/database db:migrate:deploy
pnpm --filter @decoy/database db:validate
pnpm --filter @decoy/database db:studio
```

## Environment

Expected environment variables are documented in `.env.example`.

Important ones:

- `NEXT_PUBLIC_APP_URL`
- `DATABASE_URL`
- `DIRECT_DATABASE_URL`

Note: `.env.example` also includes Better Auth variables, but auth is not wired into the current runtime flow.

## Agent Working Notes

### When changing gameplay

- Start in `packages/types` and `packages/game-engine`.
- Then update `packages/backend` to preserve server-authoritative validation.
- Finally update `apps/web/app/decoy-client.tsx` to match the new state shape and controls.

### When changing API behavior

- Keep the App Router handlers thin.
- Put business rules in `packages/backend`, not in route files.
- Watch for duplicate route aliases that may need the same update.

### When changing persistence

- Be explicit about whether the change affects:
  - JSON snapshot persistence only
  - `PlayerSession`
  - future normalized Prisma tables
- Avoid partially moving logic into normalized tables unless you finish the read/write path end to end.

### When changing UI

- Preserve the current mobile-friendly single-file flow unless doing a deliberate refactor.
- The shared UI package is minimal; most styling currently lives in `apps/web/app/globals.css`.
- `@decoy/ui` only provides a `Surface` wrapper today.

## Repo Conventions And Caveats

- Node is declared as `20.x` in package manifests, even though the README says `22+`. Prefer matching the package manifests unless the repo is intentionally upgraded.
- `apps/web/app/decoy-client.tsx` is large and central. Small features may still belong there, but larger ones should be split carefully to avoid breaking the current flow.
- There is no test suite yet in this repo.
- `next.config.ts` transpiles the shared workspace packages used by the web app.
- Root `typecheck` is wired through Turbo.
- Root `lint` exists, but there is no visible dedicated ESLint config in this snapshot; verify lint behavior before relying on it in automation.

## Recommended Change Strategy

1. Read the types, engine, backend, and UI files together before editing.
2. Make gameplay changes server-first, then wire the UI to the updated state.
3. Prefer small, consistent changes across `types -> engine -> backend -> web`.
4. Run `pnpm typecheck` after changes when dependencies are installed.

## Current State Of This Checkout

- `node_modules` is not present in this checkout right now.
- If you need verification, install dependencies first with `pnpm install`.
