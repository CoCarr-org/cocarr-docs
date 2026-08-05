# ADR-0001: Reuse and migrate, don't rewrite

## Status
Accepted.

## Context
The platform is not greenfield. `COCARR-BACKEND` (Express/Sequelize/MySQL) and
`COCARR-ADMIN` (Next.js) are working production apps. The enterprise target adds
new services and a new org, but the charter also mandates "never rewrite working
code; reuse; extend."

## Decision
Migrate the existing apps **unchanged** into the new production repos:
`COCARR-BACKEND → cocarr-core-api`, `COCARR-ADMIN → cocarr-platform-web`. Build
only genuinely new capabilities (Workspace, Identity, Authorization, Gateway,
Notification) as new services, in the **same stack** as the existing code.

## Consequences
- Zero behavioural risk to the proven business logic.
- The new backend stack is **Sequelize**, not the Prisma the initial repo
  scaffolds suggested — READMEs corrected to match reality.
- The old repos remain the live deployment until the new ones are wired and cut
  over ("migrate then retire").
