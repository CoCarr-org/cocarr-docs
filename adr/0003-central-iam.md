# ADR-0003: Central IAM in the Authorization service

## Status
Accepted.

## Context
Multiple products (Core, Workspace, future) each need access control. Duplicating
permission logic per service would drift.

## Decision
One **Authorization service** owns the taxonomy (Product→Portal→Module→Action),
roles, policies, assignments, delegation and **permission resolution**.
Permissions are strings (e.g. `workspace.employees.read`). Other services/UI ask
`POST /v1/authorize` for decisions. The web app's nav gating reads the same grid
(via core-api's `/admin/me` today; Workspace modules were registered there so the
existing gating governs them).

## Consequences
- Single source of truth for "what may this principal do?".
- `principalId` is a free string (the platform identity id) — no cross-service FK.
- Deny-wins policy evaluation; temporary access and delegation via time windows.
- Deferred: permission sets, approval chains, ABAC conditions.
