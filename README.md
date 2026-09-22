# pulse-infra

Uptime monitoring app deployed through a full DevOps pipeline: Terraform (OCI), Ansible hardening, GitHub Actions CI/CD, and Kubernetes with GitOps (ArgoCD).

This is a portfolio project built in five sequential phases, each tagged as an independent milestone:

| Phase | Status | Tag |
|---|---|---|
| 0. Planning | in progress | — |
| 1. App | not started | `v0.1.0-app` |
| 2. Infrastructure as Code (Terraform) | not started | `v0.2.0-iac` |
| 3. Hardening (Ansible) | not started | `v0.3.0-hardening` |
| 4. CI/CD (GitHub Actions) | not started | `v0.4.0-cicd` |
| 5. Kubernetes + GitOps | not started | `v0.5.0-k8s-gitops` |

## What it does

Users register URLs to watch. A background worker pings each one on an interval,
logging response time and status. A dashboard shows history, and an alert
(email or webhook) fires when a check fails.

## Stack

- **Backend:** NestJS (TypeScript)
- **Frontend:** React + TypeScript + Vite + Tailwind CSS
- **Database:** PostgreSQL via Prisma
- **Auth:** Passport + JWT
- **Notifications:** email (SMTP) and webhook, behind a pluggable notifier interface
- **Monorepo:** npm workspaces (`apps/api`, `apps/web`, `packages/shared`)

See [ADR-0001](docs/adr/0001-app-tech-stack.md) for the reasoning behind these choices.

## Infrastructure

Hosted on Oracle Cloud Infrastructure's **Always Free** tier (ARM Ampere A1.Flex
instances + free load balancer), provisioned with Terraform, hardened with
Ansible, deployed via GitHub Actions, and — from Phase 5 onward — running on
a k3s cluster managed by ArgoCD.

Infrastructure documentation, including estimated monthly cost and teardown
steps, will live under `infra/` once Phase 2 begins.

## Architecture Decision Records

Non-trivial technical decisions are recorded under [`docs/adr/`](docs/adr/)
using the standard ADR format (context, decision, consequences).

## Status

This project is under active, incremental development. See the phase table
above and [CHANGELOG.md](CHANGELOG.md) for progress.

## License

[MIT](LICENSE)
