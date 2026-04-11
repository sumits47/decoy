# @decoy/database

Prisma + Neon foundations for Decoy.

Current backend flows can keep using `Lobby.stateJson` + `PlayerSession` while the richer normalized tables are ready for the next persistence step.

## Environment

Set both connection strings:

- `DATABASE_URL`: pooled Neon connection used by Prisma Client at runtime
- `DIRECT_DATABASE_URL`: direct Neon connection used for migrations / schema operations

## Commands

```bash
pnpm --filter @decoy/database db:generate
pnpm --filter @decoy/database db:migrate:dev
pnpm --filter @decoy/database db:migrate:deploy
pnpm --filter @decoy/database db:validate
pnpm --filter @decoy/database db:studio
```
