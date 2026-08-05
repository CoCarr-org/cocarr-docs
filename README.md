# cocarr-docs

> Enterprise Documentation Repository.

Part of the **Cocarr Enterprise Platform** ([CoCarr-org](https://github.com/CoCarr-org)).

Topics: `architecture`, `documentation`, `adr`, `api`

## Purpose
Single source of truth for platform architecture, Architecture Decision Records (ADRs) and cross-service API documentation.

## Architecture
This repository is one component of the Cocarr platform, a service-oriented
system fronted by the API gateway. Requests flow through the gateway to the
identity, authorization, workspace, core and notification services, each backed
by its own database. See [`cocarr-docs`](https://github.com/CoCarr-org/cocarr-docs)
for the full platform architecture and Architecture Decision Records.

## Technology Stack
- Markdown
- Architecture Decision Records
- OpenAPI

## Folder Structure
```
architecture/ # System and service architecture
adr/          # Architecture Decision Records
api/          # Cross-service API contracts (OpenAPI)
.github/      # Issue/PR templates, workflows, CODEOWNERS
```

## Getting Started
```bash
# Clone
git clone https://github.com/CoCarr-org/cocarr-docs.git
cd cocarr-docs

# Work from the develop branch
git checkout develop
```
Copy `.env.example` to `.env` where applicable and install dependencies with
your package manager (`pnpm install`).

## Development
- Format: `pnpm prettier --write .`
- Lint: `pnpm lint`
- Test: `pnpm test`

Editor settings, Prettier, ESLint, EditorConfig and VS Code configuration ship
with the repository for a consistent developer experience.

## Contributing
Please read [CONTRIBUTING.md](CONTRIBUTING.md) and use the issue and pull
request templates. All changes require CODEOWNER review.

## Branch Strategy
| Branch    | Purpose                                   | Protected |
|-----------|-------------------------------------------|-----------|
| `main`    | Always-deployable production baseline     | Yes       |
| `develop` | Integration branch for feature work       | No        |
| `release` | Release-candidate stabilisation branch    | Yes       |

Feature branches: `feature/<description>` from `develop`.

## Deployment
Documentation is versioned here and published from the default branch.

## Security
See [SECURITY.md](SECURITY.md) for vulnerability reporting. Dependabot alerts
and secret scanning are enabled where supported.

## License
Licensed under the [MIT License](LICENSE).
