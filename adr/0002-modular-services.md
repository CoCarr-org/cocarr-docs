# ADR-0002: Core stays whole; new bounded contexts are new services

## Status
Accepted.

## Context
The charter lists six backend services. The existing backend is a single
Sequelize monolith that already implements most of "Identity" and "Authorization"
in-process (`resolveAccess`, `requirePermission`).

## Decision
Do not carve the working monolith apart. Keep it as **Core API**. Stand up the
genuinely-new bounded contexts — Workspace, Identity, Authorization, Notification
— as their own services, plus the Gateway. Extracting Core's in-process RBAC into
the Authorization service is a later, deliberate step, not a rip-out.

## Consequences
- Fast, low-risk delivery; the monolith keeps working.
- Two RBAC implementations coexist temporarily (Core's local grid + the central
  Authorization service). Convergence is tracked as future work.
