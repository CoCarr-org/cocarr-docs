# ADR-0004: One web codebase, a build-time panel per product

## Status
Accepted.

## Context
The existing admin app already serves multiple internal products via
`NEXT_PUBLIC_PANEL` — each product/team is the same codebase built with a
different panel value, deployed to its own host.

## Decision
Keep one Next.js codebase (`cocarr-platform-web`) at the repo root. Add new
products (e.g. Workspace) as **panels**, not separate apps. `NEXT_PUBLIC_*` is
inlined at build time, so each panel is a separate build/deploy of the same repo.

## Consequences
- No duplication of layouts, auth, permission model or the generic CRUD UI.
- `workspace.cocarr.com` = this repo built with `NEXT_PUBLIC_PANEL=workspace`.
- Screens that call a different service pass an `api` flag (e.g. `workspace`) so
  the shared `ResourceManager` targets the right backend.
