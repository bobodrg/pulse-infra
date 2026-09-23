# @pulse-infra/api

Backend API and background monitor worker for pulse-infra, built with [NestJS](https://nestjs.com).

See the root [README](../../README.md) and [ADR-0001](../../docs/adr/0001-app-tech-stack.md) for the overall project and stack rationale.

## Development

```bash
cp .env.example .env
npm install
npm run start:dev --workspace apps/api
```

## Scripts

- `npm run start:dev` — run with hot reload
- `npm run build` — compile to `dist/`
- `npm test` — run unit tests (Vitest)
- `npm run test:e2e` — run end-to-end tests
- `npm run lint` — lint with oxlint

## Health check

`GET /health` returns `{ status: "ok", timestamp }` — used later for container/Kubernetes liveness probes.
