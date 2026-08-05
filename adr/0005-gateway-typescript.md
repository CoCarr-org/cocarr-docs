# ADR-0005: The gateway is TypeScript; everything else is JavaScript

## Status
Accepted.

## Context
The platform stack is Node/Express + Sequelize (JavaScript), to match the
existing apps. The gateway, however, is a greenfield edge component with a
provided TypeScript structure and benefits from static types for its config,
middleware and proxy wiring.

## Decision
Build `cocarr-api-gateway` in **TypeScript** (compiled to `dist/`); keep all
other services in JavaScript. The gateway does no business logic, so the stack
split has no bleed-through.

## Consequences
- Type safety where the routing/proxy config is easy to get wrong.
- A multi-stage Docker build (tsc → run `dist/`).
- One extra toolchain to maintain, isolated to one repo.
