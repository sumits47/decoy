# Decoy

Decoy is a web-first social bluffing party game.

This repository is a pnpm monorepo designed for:
- a Next.js web app in `apps/web`
- shared packages for game rules, typed contracts, configuration, backend orchestration, and UI primitives
- deployment to Vercel
- future native iOS and Android clients built from the same product/domain model

## Monorepo structure

```text
apps/
  web/                # Next.js App Router app
packages/
  backend/            # server-only domain orchestration placeholders
  config/             # shared app metadata/config
  game-engine/        # shared gameplay phase/rules scaffolding
  types/              # typed domain contracts
  ui/                 # shared UI primitives
```

## Getting started

### Prerequisites
- Node.js 22+
- pnpm 10+

### Install

```bash
pnpm install
```

### Run the web app

```bash
pnpm dev
```

Then open `http://localhost:3000`.

## Scripts

```bash
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
```

## Environment

Copy `.env.example` to `.env.local` (or your preferred local env file) and adjust values as needed.

## Product direction

The web app is the first milestone. Native iOS/Android clients will come later after the gameplay loop, retention, moderation, and realtime model are validated on the web.

## Technical plan

See [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md).
