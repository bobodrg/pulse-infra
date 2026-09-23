# @pulse-infra/api

Backend API and background monitor worker for pulse-infra, built with [NestJS](https://nestjs.com).

See the root [README](../../README.md) and [ADR-0001](../../docs/adr/0001-app-tech-stack.md) for the overall project and stack rationale.

## Development

```bash
cp .env.example .env
npm install
```

Start a local PostgreSQL instance (a proper `docker-compose.yml` for local
dev lands at the end of Phase 1 — for now, a plain container is enough):

```bash
docker run -d --name pulse-infra-dev-pg \
  -e POSTGRES_USER=pulse -e POSTGRES_PASSWORD=pulse -e POSTGRES_DB=pulse_infra \
  -p 5432:5432 postgres:17-alpine
```

Apply migrations and generate the Prisma client, then start the API:

```bash
npm run prisma:migrate --workspace apps/api
npm run start:dev --workspace apps/api
```

## Scripts

- `npm run start:dev` — run with hot reload
- `npm run build` — compile to `dist/`
- `npm test` — run unit tests (Vitest)
- `npm run test:e2e` — run end-to-end tests
- `npm run lint` — lint with oxlint

## Database

PostgreSQL via [Prisma](https://www.prisma.io), using the `@prisma/adapter-pg`
driver adapter (Prisma 7 no longer reads the connection URL from
`schema.prisma`; it's configured in `prisma.config.ts` and passed to
`PrismaClient` via the adapter — see `src/prisma/prisma.service.ts`).

- `npm run prisma:migrate --workspace apps/api` — create/apply a dev migration
- `npm run prisma:generate --workspace apps/api` — regenerate the client after schema changes
- `npm run prisma:studio --workspace apps/api` — browse data locally

Schema: `prisma/schema.prisma`. Migrations are committed under `prisma/migrations/`; the generated client (`generated/`) is not — run `npm run prisma:generate --workspace apps/api` after cloning or after any schema change.

## Health check

`GET /health` returns `{ status, timestamp, database }`, including a live
`SELECT 1` check against PostgreSQL — used later for container/Kubernetes
liveness/readiness probes. Returns `503` if the database is unreachable.

## Notes

`npm audit` flags high-severity issues in `mysql2`, pulled in transitively by
the `prisma` CLI package (which bundles driver support for every database it
can talk to, not just the PostgreSQL one this project uses). This only
affects local/CI dev tooling, not the running API — `prisma` is a
devDependency and the vulnerable code path requires connecting to a
malicious MySQL server, which this project never does. Worth revisiting when
the production Dockerfile is written (Phase 1, final step) to make sure the
runtime image doesn't ship the `prisma` CLI at all, only `@prisma/client` and
the generated client.
