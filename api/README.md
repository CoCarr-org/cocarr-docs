# API Reference

The public surface is the **API Gateway** (`api.cocarr.com`). It verifies the
JWT, then proxies to each service, rewriting `/v1/<prefix>/*` to the upstream's
`/v1/*`.

| Gateway path | Service | Auth | Live docs (per service) |
|---|---|---|---|
| `/v1/auth/*` | Identity | public | `<identity>/v1/docs` |
| `/v1/platform/*` | Authorization | JWT | `<authorization>/v1/docs` |
| `/v1/workspace/*` | Workspace | JWT | `<workspace>/v1/docs` |
| `/v1/core/*` | Core | JWT | `<core>/v1/docs` |
| `/v1/notify/*` | Notification | JWT | `<notification>/v1/docs` |

Each service serves an OpenAPI/Swagger UI at its own `/v1/docs`. The gateway
serves its routing surface at `/docs`.

## Auth model
1. Sign in with Firebase → ID token.
2. `POST /v1/auth/verify` → platform session + refresh token (rotated on use).
3. Send the Firebase ID token as `Authorization: Bearer <token>` to the gateway;
   it verifies and forwards `x-user-id` downstream.
4. Access decisions: `POST /v1/platform/authorize { principalId, permission }`.

## Conventions
- Errors: `{ "error": { "code": "...", "message": "..." } }`.
- Lists: `{ "data": [...], "totalCount": N }` with `?offset&limit&search`.
- Correlation: the gateway sets `x-correlation-id`, propagated to every service.
