# Decoy — Technical Implementation Plan

## 1. Goal

Build **Decoy**, a web-first multiplayer bluffing party game inspired by social deception / fake-answer games.

The initial release should optimize for:
- low-friction room creation
- mobile browser usability
- fast round pacing
- reliable realtime game state
- high social replayability

The long-term product direction is:
1. **Web app first** (Next.js on Vercel)
2. Validate retention, session completion, and moderation needs
3. Expand to **native iOS and Android apps** using the same core domain model and gameplay engine

---

## 2. Product scope for MVP

### Core MVP player journey
1. Player lands on Decoy homepage
2. Player creates a lobby or joins with a room code/link
3. Players enter display names
4. Host starts a game
5. Game runs through multiple rounds:
   - prompt presented
   - players submit fake answers
   - players vote on which answer is real
   - round results shown
   - cumulative scores updated
6. Game ends with leaderboard and replay option

### MVP features
- Lobby creation with short room codes
- Join by code/link
- Host controls (start game, next round, kick inactive player if needed)
- Timed rounds
- Prompt deck for at least one polished mode
- Fake-answer submission
- Voting/reveal/scoring
- Scoreboard
- Basic reconnect handling
- Responsive UI optimized for mobile browsers

### Explicit non-goals for MVP
- Native iOS/Android apps
- Large social graph / friends list
- Rich player profiles
- UGC prompt authoring by players
- Voice/video chat
- Advanced cosmetics or monetization
- Complex matchmaking

---

## 3. Architecture recommendation

## Monorepo

Use a pnpm monorepo with clear app/package boundaries.

### Proposed structure

```text
apps/
  web/
packages/
  backend/
  config/
  game-engine/
  types/
  ui/
```

### Responsibility split

#### `apps/web`
- Next.js App Router application
- landing page, auth surfaces, lobby UI, gameplay UI
- route handlers / server actions for web-specific integration points
- deployment target for Vercel

#### `packages/game-engine`
- shared game rules
- round state transitions
- scoring rules
- prompt/result evaluation contracts
- deterministic reducer/state machine logic where possible

#### `packages/types`
- shared domain types
- lobby/game/player/round event contracts
- client-server payload typing

#### `packages/backend`
- server-only orchestration abstractions
- lobby/game lifecycle services
- persistence adapters
- realtime event coordination interfaces

#### `packages/ui`
- design primitives
- shared components for later multi-app reuse

#### `packages/config`
- shared metadata, constants, feature flags, environment helpers

---

## 4. Frontend stack

### Choice
- **Next.js App Router**
- TypeScript
- React 19
- Vercel deployment

### Why Next.js fits
- excellent Vercel integration
- hybrid SSR/CSR options
- route handlers for lightweight server APIs
- strong developer velocity
- easy browser-first product launch

### UI recommendation
Start lean:
- CSS modules or a single global stylesheet at bootstrap stage
- add a component system gradually
- avoid over-investing in design tooling before gameplay is proven

If velocity becomes a problem later, adopt:
- Tailwind + class-variance-authority, or
- a design token system with shared primitives

---

## 5. Backend and persistence

## Recommended stack for production MVP
- **Postgres** (Neon/Supabase/RDS-class managed Postgres)
- **Prisma** as ORM/migration tool
- Next.js route handlers / server actions for core app APIs
- dedicated realtime layer for game sessions

### Why Postgres + Prisma
- durable relational model for users, lobbies, rounds, prompts, and analytics
- easy migration path as product grows
- good fit for Vercel ecosystem
- Prisma offers strong schema/type ergonomics for a TypeScript team

### Suggested core entities
- `User` (optional/expandable if auth is present at MVP)
- `GuestProfile`
- `Lobby`
- `LobbyPlayer`
- `GameSession`
- `Round`
- `Prompt`
- `SubmittedAnswer`
- `Vote`
- `ScoreEvent`
- `PlayerPresence`

### Initial data ownership guidance
- Postgres is source of truth for durable data
- in-memory realtime session state may be used during active games
- session checkpoints should be written back on important transitions

---

## 6. Auth strategy

## Recommendation
For MVP, support **guest play first**, with optional lightweight auth later.

### MVP auth model
- players can join with a display name
- host gets a temporary signed session token/cookie
- reconnect is supported through browser storage + secure server-issued token

### Later auth expansion
- OAuth or email magic link for persistent identity
- player stats/history
- friends/invites
- cross-device identity for native apps

### Why not require auth on day 1
Party games win on low friction. Mandatory signup is likely to hurt room conversion.

---

## 7. Multiplayer / realtime approach

This is the most important architecture decision after gameplay.

## Options considered

### Option A — Polling only
**Pros**
- simplest to build
- easiest to deploy

**Cons**
- poor game feel
- delayed reveals/votes
- wasteful network traffic
- not ideal for a social party game

**Verdict:** not recommended except as fallback.

### Option B — WebSockets via dedicated realtime service
Examples:
- Ably
- Pusher
- Liveblocks (depending on fit)
- custom WebSocket server

**Pros**
- best user experience
- low-latency voting/reveal updates
- supports presence cleanly
- easier to model live game state

**Cons**
- added infrastructure complexity
- requires careful server authority model

**Verdict:** recommended.

### Option C — Server-Sent Events + POST mutations
**Pros**
- simpler than full WebSockets
- decent server-to-client update model

**Cons**
- weaker for bidirectional high-frequency interaction
- more awkward for presence and live game orchestration

**Verdict:** acceptable fallback, but still second-best.

## Recommendation
Use a **server-authoritative realtime model**.

### Recommended setup
- Next.js app on Vercel for product UI and standard APIs
- managed realtime provider for live game channels/events
- server owns phase transitions, timers, scoring, and reveal logic
- clients are dumb renderers + input senders

### Why this matters
A bluffing game is vulnerable to:
- race conditions
- duplicate submissions
- client-side tampering
- vote leaks
- timer abuse

Server authority keeps gameplay fair.

---

## 8. Gameplay system design

## High-level phase model
Model the game as a strict state machine.

### Lobby phases
- `waiting`
- `ready`
- `starting`

### Round phases
- `prompt`
- `submission`
- `submission_locked`
- `voting`
- `reveal`
- `score`
- `complete`

### Match phases
- `lobby`
- `in_round`
- `intermission`
- `finished`

## Recommended server-authoritative flow
1. Create lobby
2. Add players
3. Host starts match
4. Server selects prompt
5. Server opens submission window with deadline
6. Players submit answers
7. Server closes submissions
8. Server shuffles real answer + decoys
9. Server opens voting window
10. Players vote
11. Server computes scoring
12. Server emits reveal payload
13. Server updates cumulative scores
14. Repeat until final round complete

## Scoring system
Initial MVP scoring can be simple and readable:
- player gets points for choosing real answer
- player gets points per opponent fooled by their decoy
- optional bonus for unanimous fooling or fastest correct vote (later, not MVP)

## Prompt system
Store prompts with metadata:
- `id`
- `text`
- `canonicalAnswer`
- `category`
- `difficulty`
- `locale`
- `status` (draft/active/retired)
- moderation metadata if UGC arrives later

### Recommendation
Start with curated prompts only.

---

## 9. Suggested API/domain boundaries

### Web/API concerns
- create/join lobby
- host controls
- reconnect/session token issuance
- prompt deck retrieval (server only)
- score snapshots / match summaries

### Realtime concerns
- presence updates
- round phase changes
- countdown timers
- answer submitted events (without leaking answer contents unnecessarily)
- vote received acknowledgements
- reveal payloads
- scoreboard updates

### Shared domain contracts
Put these in `packages/types` and `packages/game-engine`.

---

## 10. Vercel deployment plan

## Web app
Deploy `apps/web` to Vercel as the main project.

### Environment separation
- Development
- Preview
- Production

### Recommended environment variables
- `NEXT_PUBLIC_APP_URL`
- `DATABASE_URL`
- auth secret(s)
- realtime provider credentials
- analytics keys (later)

### Vercel usage
Use Vercel for:
- hosting the Next.js frontend
- route handlers / edge-safe APIs where appropriate
- preview deployments per branch/PR

### Important caveat
Do **not** force all active game session state into ephemeral Vercel function memory. Use:
- managed database for durable state
- managed realtime/pubsub/session system for live state

---

## 11. Native app roadmap

Once the web experience is validated, add:
- `apps/mobile` (likely React Native / Expo if shared JS stack is preferred), or
- true native clients if product requirements justify it later

### Shared assets for mobile readiness
Keep shared logic in packages from day 1:
- `game-engine`
- `types`
- maybe `config`

### Native-specific goals later
- push notifications for invites / turn reminders
- native share sheet invite flows
- platform identity integration
- better background/reconnect behavior

### Why web first is right
- faster iteration
- no app store review friction
- easier multiplayer UX validation
- faster prompt/content iteration

---

## 12. Testing strategy

## Unit tests
Target first:
- scoring rules
- state transitions
- prompt selection rules
- answer shuffling / reveal behavior
- anti-duplication rules for submissions/votes

Best home: `packages/game-engine`

## Integration tests
Target:
- lobby create/join/start flows
- reconnect flow
- end-to-end round lifecycle against test backend/realtime mocks

## End-to-end tests
Use Playwright for:
- create room
- join from second browser context
- play through one round
- verify reveal and scoreboard

## Load / reliability checks
Before launch, simulate:
- many concurrent lobbies
- reconnect storms
- stale host disconnect
- timer expiration with slow clients

---

## 13. Security and abuse considerations

Party games look simple but have real abuse vectors.

## Abuse risks
- offensive names/content
- prompt injection if UGC is added later
- spam room creation
- automated joins/bots
- answer leakage via manipulated clients
- tampering with timers/submissions/votes

## MVP safeguards
- server-authoritative game logic
- input validation on every mutation
- profanity/name filters
- rate limits on lobby creation/join attempts
- signed player session tokens
- anti-replay protections on critical actions
- audit logs for suspicious room events

## Privacy considerations
- collect minimal PII initially
- allow guest play
- define retention policy for match events and analytics
- be explicit if chat/UGC is later introduced

---

## 14. Observability

From early on, track:
- lobby created
- lobby join success rate
- lobby abandonment before game start
- average players per lobby
- round completion rate
- match completion rate
- reconnect frequency
- average session duration

### Product metrics to watch
- room start conversion
- game completion rate
- rematch rate
- day-1 / day-7 return rates

### Technical metrics to watch
- join latency
- realtime event fanout latency
- dropped connection rate
- duplicate submission/vote incidents

---

## 15. Delivery roadmap

## Phase 0 — Bootstrap (this repo)
- monorepo structure
- web shell
- implementation plan
- shared package boundaries

## Phase 1 — Core prototype
- lobby create/join
- local/server round loop
- curated prompts
- scoring + reveal
- basic responsive UI

## Phase 2 — Realtime MVP
- managed realtime integration
- reconnect handling
- server-authoritative timers
- host controls

## Phase 3 — Productionization
- Postgres + Prisma
- guest session durability
- analytics/observability
- moderation basics
- preview/prod deployment hardening on Vercel

## Phase 4 — Growth features
- more game modes
- content operations pipeline
- lightweight accounts
- social sharing/invites

## Phase 5 — Native expansion
- mobile app(s)
- shared gameplay contracts and APIs reused from monorepo

---

## 16. Immediate next build steps

1. Install dependencies with `pnpm install`
2. Run the web shell locally
3. Pick a realtime provider and prototype a single authoritative room lifecycle
4. Implement `Lobby`, `GameSession`, and `Round` contracts in `packages/types`
5. Build a deterministic round reducer in `packages/game-engine`
6. Add a minimal persistence layer plan for Postgres + Prisma
7. Create a clickable vertical slice:
   - homepage
   - create lobby
   - join lobby
   - one playable round

---

## 17. Recommendation summary

If the goal is to ship Decoy quickly and correctly:
- **Web first** is the right call
- **Next.js on Vercel** is the right product shell
- **Postgres + Prisma** is the right durable data foundation
- **Server-authoritative realtime multiplayer** is the right gameplay architecture
- **Monorepo with shared game-engine/types** is the right long-term structure for eventual native clients

The strongest technical principle for Decoy is simple:

> Treat the game as a server-authoritative state machine, and treat every client as a fast, delightful interface on top of that truth.
