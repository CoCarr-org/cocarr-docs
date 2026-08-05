# cocarr-docs

> Enterprise Documentation Repository.

The single source of truth for the **Cocarr platform** architecture, decisions
(ADRs) and cross-service API references.

## Contents
- [`architecture/overview.md`](architecture/overview.md) — the platform map, request flow, principles
- [`architecture/services.md`](architecture/services.md) — every service: purpose, port, endpoints, database
- [`architecture/data.md`](architecture/data.md) — which database holds which tables
- [`adr/`](adr/) — Architecture Decision Records (the *why* behind the build)
- [`api/README.md`](api/README.md) — API surface + live Swagger per service

## The platform at a glance
| Layer | Repos |
|---|---|
| Web | `cocarr-platform-web` (Next.js, panel-per-product) |
| Edge | `cocarr-api-gateway` (TypeScript) |
| Services | `cocarr-identity-service`, `cocarr-authorization-service`, `cocarr-workspace-api`, `cocarr-core-api`, `cocarr-notification-service` |
| Data | `cocarr-iam-db`, `cocarr-core-db`, `cocarr-workspace-db` (MySQL) |
| Ops | `cocarr-devops` (Docker, Railway, CI) |

All services share one stack — **Node/Express + Sequelize + MySQL + Firebase** —
except the gateway (**TypeScript**). The web app is **Next.js**. See
[ADR-0001](adr/0001-reuse-not-rewrite.md) for why.
