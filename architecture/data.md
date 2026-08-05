# Data Ownership

Every service owns its own schema via Sequelize `db.sync({ alter: true })`.
The database repos ([cocarr-iam-db](https://github.com/CoCarr-org/cocarr-iam-db),
[cocarr-core-db](https://github.com/CoCarr-org/cocarr-core-db),
[cocarr-workspace-db](https://github.com/CoCarr-org/cocarr-workspace-db)) hold schema **documentation**,
hand-written SQL **migrations** for production-grade changes, and **seed** data —
they are not an ORM of record.

| Database | Owned by | Tables (high level) |
|---|---|---|
| **IAM DB** | Identity + Authorization | identities, devices, sessions · products, portals, modules, permissions, roles, rolePermissions, roleAssignments, policies, delegations, auditLogs |
| **Core DB** | Core API + Notification | bookings, hosts, vehicles, payments, payouts, wallet, memberships, referrals, KYC, admin RBAC (~90 tables) · templates, notifications |
| **Workspace DB** | Workspace API | employees, departments, designations, teams, employeeDocuments, candidates, accessRequests, counters |

## Cross-service identity
The **platform identity id** (uuid, from the Identity service) is the stable key
other services reference. Firebase UID is stored **only** on the Identity's
`identity` row and is never used as a foreign key elsewhere. Workspace employees
carry their own `EMP-000001` business code, mapped to a Firebase UID separately.
