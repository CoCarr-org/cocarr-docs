# Services

Every service exposes `/v1/health` and Swagger at `/v1/docs`, boots resiliently
(listens even if the DB is down), and treats Firebase as optional in dev.

| Service | Port | Stack | Database | Gateway prefix |
|---|---|---|---|---|
| [cocarr-api-gateway](https://github.com/CoCarr-org/cocarr-api-gateway) | 8080 | TypeScript/Express | — | — |
| [cocarr-identity-service](https://github.com/CoCarr-org/cocarr-identity-service) | 3050 | Express/Sequelize | IAM DB | `/v1/auth` |
| [cocarr-authorization-service](https://github.com/CoCarr-org/cocarr-authorization-service) | 3060 | Express/Sequelize | IAM DB | `/v1/platform` |
| [cocarr-workspace-api](https://github.com/CoCarr-org/cocarr-workspace-api) | 3040 | Express/Sequelize | Workspace DB | `/v1/workspace` |
| [cocarr-core-api](https://github.com/CoCarr-org/cocarr-core-api) | 3030 | Express/Sequelize | Core DB | `/v1/core` |
| [cocarr-notification-service](https://github.com/CoCarr-org/cocarr-notification-service) | 3070 | Express/Sequelize | Core DB | `/v1/notify` |

## Highlights
- **Identity** — `POST /v1/auth/verify` (Firebase token → session + refresh
  token, hashed at rest, single-use rotation), devices, password links. No roles.
- **Authorization** — Products→Portals→Modules→Permissions, roles, allow/deny
  policies (deny wins), assignments with `expiresAt` (temporary access),
  delegation windows, and `POST /v1/authorize`.
- **Workspace** — recruitment → onboarding → approval (mints `EMP-000001`,
  Firebase login, one-time reset link), org structure, reporting hierarchy.
- **Core** — the full migrated car-sharing platform (unchanged).
- **Notification** — email/SMS/push with `{var}` templates; channels simulate
  when unconfigured; every send is recorded.

Each repo's own `CLAUDE.md` documents its load-bearing details and what's deferred.
