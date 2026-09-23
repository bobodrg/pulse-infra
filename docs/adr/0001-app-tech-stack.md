# ADR-0001: Application Tech Stack

## Status
Accepted, with one amendment (see below)

## Context
`pulse-infra` is a portfolio project demonstrating full-stack and infrastructure
engineering to a professional standard. Phase 1 requires building an uptime/status
monitor: users register URLs to watch, a background worker pings them on an
interval and records response time/status, a dashboard shows history, and an
alert (email/webhook) fires on failure.

The app itself is one part of a five-phase project (App → IaC → Hardening →
CI/CD → Kubernetes/GitOps). It needs to:
- Run comfortably on an OCI Always Free ARM (A1.Flex) VM with modest RAM.
- Be straightforward to containerize, harden, and later deploy to Kubernetes.
- Reflect conventions and tooling a professional engineering org would
  recognize, without over-engineering a small monitoring tool.

Candidate stacks considered: Go + React, Python (FastAPI) + React, and
Node/TypeScript end-to-end. Node/TypeScript was selected.

## Decision
- **Monorepo layout (npm workspaces):** `apps/api` (backend), `apps/web`
  (frontend), `packages/shared` (shared TypeScript types/DTOs between
  frontend and backend). npm workspaces was chosen over Nx/Turborepo — the
  project is small enough that a heavier monorepo tool would be premature.
- **Backend: NestJS.** Chosen over bare Express for its opinionated module/
  controller/service structure, built-in dependency injection, guards/pipes
  for auth and validation, and first-class testing support (`@nestjs/testing`)
  — conventions closer to what a professional backend team would use than an
  unstructured Express app.
- **Database: PostgreSQL, accessed via Prisma.** Prisma gives type-safe
  queries and a migration workflow that pairs naturally with the shared-types
  approach. PostgreSQL (over SQLite) mirrors production practice and sets up
  Phase 2's database ADR (self-managed Postgres container vs. OCI Autonomous
  Database) as a real choice rather than a foregone one.
- **Background worker: in-process scheduling via `@nestjs/schedule`**, running
  inside the same Nest process as the API (not a separate worker service or
  queue). Interval pinging is handled with cron-style jobs within the app.
- **Auth: Passport + JWT** (`@nestjs/passport`, `@nestjs/jwt`) — short-lived
  access token plus an httpOnly-cookie refresh token. No third-party OAuth;
  it wouldn't add meaningful signal for a single/few-user tool.
- **Frontend: React + TypeScript + Vite + Tailwind CSS**, with Recharts for
  response-time history graphs. A separate SPA consuming the API as JSON,
  sharing request/response types with the backend via `packages/shared`.
- **Notifications: a pluggable `NotifierService` strategy interface**, with
  an email implementation (Nodemailer over SMTP) and a webhook implementation
  (generic JSON POST, Slack/Discord-compatible). New channels are a one-file
  addition.
- **Testing: Jest** for backend unit and integration tests (integration tests
  run against a real PostgreSQL instance via `testcontainers`), and
  **Vitest + React Testing Library** for frontend tests.

## Consequences
- Single language (TypeScript) across backend, frontend, and shared types
  reduces context-switching and lets DTOs be shared directly instead of
  duplicated or generated.
- Running the scheduler in-process avoids standing up Redis/a queue purely
  for a handful of periodic pings, which keeps the Always Free VM's resource
  usage low and the deployment topology simple — at the cost of not
  demonstrating a distributed job-queue pattern. If the monitor's scale ever
  warranted it, extracting the scheduler into a separate worker with BullMQ
  and Redis would be a natural, isolated follow-up.
- NestJS and Prisma both bring more structure/boilerplate than a minimal
  Express + raw SQL setup would. That's accepted here because the goal is to
  demonstrate conventions a professional org would recognize, not to
  minimize line count.
- PostgreSQL requires a running database for local dev and tests (handled via
  `docker-compose` for local dev, `testcontainers` for CI), rather than the
  zero-setup of SQLite.
- The JWT refresh-token-in-cookie approach requires CSRF consideration on any
  state-changing endpoint reachable from a browser context; this will be
  addressed when auth is implemented (Phase 1, auth step).

## Amendment (2026-09-22): backend test runner

Superseded: backend tests use **Vitest**, not Jest as originally decided.

When scaffolding `apps/api`, the current NestJS CLI's default project
template ships Vitest (plus oxlint) rather than Jest/ESLint. Adopting the
generated defaults keeps the project aligned with what NestJS itself now
recommends for new projects, rather than tearing out the scaffold to bolt
Jest back in. This also makes the whole repo single-test-runner, since the
frontend was already going to use Vitest — a minor added benefit, not the
original motivation. Everything else in this ADR (framework, ORM, auth,
worker approach, monorepo layout) is unchanged.
