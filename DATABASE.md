# Database topology — one instance, one schema per service

**ONE MySQL instance. ONE SCHEMA PER SERVICE. Each service owns its schema and
never touches another's.**

| Service | Schema | Models |
|---|---|---|
| cocarr-core-api | `cocarr_core` | 77 |
| cocarr-authorization-service | `cocarr_iam` | 21 |
| cocarr-workspace-api | `cocarr_workspace` | 12 |
| cocarr-identity-service | `cocarr_identity` | 3 |
| cocarr-notification-service | `cocarr_notification` | 2 |

Every service reads the same five variables: `DB_HOST`, `DB_PORT`, `DB_NAME`,
`DB_USER`, `DB_PASS`. Only `DB_NAME` (and, once grants are in place, the
user) differs between them.

## Why not one shared schema

Because two table names already collide, with unrelated shapes:

| table | core-api | authorization-service |
|---|---|---|
| `featureFlags` | `key, label, description, isEnabled` | `key, name, description, isEnabled, scopeType, scopeId` |
| `rolePermissions` | `role, module, canCreate/Read/Update/Delete` (a permission **grid**) | `roleId, permissionId` (a **join table**) |

Both services run `db.sync({ alter: true })` on every boot. In a shared schema
each deploy would rewrite the shared table into its own shape — core-api's sync
dropping `scopeType`/`scopeId`, IAM's dropping `label`/`module`/`canCreate*`.
Whichever container restarted last would win, permanently, and the other service
would silently lose columns and data on every deploy.

The second reason is blast radius. `alter:true` aborts the **whole pass** on one
bad foreign key or once a table trips MySQL's 64-key limit, and every model after
the failure point silently gets no table. Confined to one schema that breaks one
service. In a shared schema, one bad model in core-api's 77 would take out IAM's
21 tables — and IAM is on the authentication path for **every request on the
platform**.

## Why not one instance per service

77 / 21 / 12 / 3 / 2 models is not that scale. One instance is one backup, one
endpoint, one thing to monitor, one bill. Revisit when the noisy-neighbour risk
below actually bites; the first service worth splitting out is IAM, precisely
because it is on the hot path.

## Isolation is grants, not convention

Without per-service users, "each service owns its schema" is a naming habit —
nothing stops a mistyped `DB_NAME` letting one service's `alter:true` loose on
another's tables. Given that a wrong `DB_NAME` has already caused an outage
here, this is the control that matters:

```sql
CREATE DATABASE IF NOT EXISTS cocarr_core        CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS cocarr_iam         CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS cocarr_workspace   CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS cocarr_identity    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS cocarr_notification CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'svc_core'@'%'         IDENTIFIED BY '…';
CREATE USER IF NOT EXISTS 'svc_iam'@'%'          IDENTIFIED BY '…';
CREATE USER IF NOT EXISTS 'svc_workspace'@'%'    IDENTIFIED BY '…';
CREATE USER IF NOT EXISTS 'svc_identity'@'%'     IDENTIFIED BY '…';
CREATE USER IF NOT EXISTS 'svc_notification'@'%' IDENTIFIED BY '…';

-- Each user can see exactly one schema. A service pointed at the wrong DB_NAME
-- now fails with ACCESS DENIED at startup instead of quietly altering somebody
-- else's tables.
GRANT ALL PRIVILEGES ON cocarr_core.*         TO 'svc_core'@'%';
GRANT ALL PRIVILEGES ON cocarr_iam.*          TO 'svc_iam'@'%';
GRANT ALL PRIVILEGES ON cocarr_workspace.*    TO 'svc_workspace'@'%';
GRANT ALL PRIVILEGES ON cocarr_identity.*     TO 'svc_identity'@'%';
GRANT ALL PRIVILEGES ON cocarr_notification.* TO 'svc_notification'@'%';
FLUSH PRIVILEGES;
```

`ALL PRIVILEGES` on its own schema is required while services run
`db.sync({ alter: true })` — they need DDL. It narrows to `SELECT, INSERT,
UPDATE, DELETE` the day migrations replace boot-time sync (see below).

## When something is wrong

Every service now runs a **preflight** before its sync
(`src/configs/dbPreflight.js`, identical in all five). It classifies the failure
and names the fix, instead of booting healthy and 400ing every request:

```
!!! DATABASE UNREACHABLE — EVERY QUERY WILL FAIL !!!
  The schema 'cocarr_core' does not exist on db.internal.
  fix: node scripts/ensureDatabase.js --confirm   (then the schema/seed scripts)
  DB_NAME=cocarr_core DB_HOST=db.internal DB_USER=svc_core
```

It distinguishes: missing env vars · schema does not exist · access denied ·
host does not resolve · connection refused · timeout. Services still boot and
still serve `/health` — refusing to start would hide the reason — and `/health`
reports `db:false` with a 503, which fails the deploy healthcheck so a broken
deploy is rejected rather than silently replacing a working one.

### Creating a schema

`scripts/ensureDatabase.js` exists in every service. It is **deliberately not**
boot behaviour: auto-creating on startup turns a typo into a silent disaster —
point `DB_NAME` at `cocarr_iamm` and the service would create it, sync a full
set of tables into it and come up perfectly healthy with no data, while the real
schema sits untouched beside it.

```bash
railway run node scripts/ensureDatabase.js --dry-run   # lists existing schemas, changes nothing
railway run node scripts/ensureDatabase.js --confirm   # CREATE DATABASE IF NOT EXISTS, no tables
```

It prints the other schemas on the instance first, on purpose: **if your data is
in one of them under a different name, fix `DB_NAME` — do not create a new empty
schema beside it.**

### Then create the tables

| Service | Next step |
|---|---|
| core-api | `node scripts/initSchema.js --confirm` (fresh) or `syncNewTables.js` (missing tables only) |
| authorization-service | `node scripts/syncTables.js` then `node scripts/seedTaxonomy.js --confirm` |
| workspace / identity / notification | restart — boot `db.sync({alter:true})` creates them |

## An empty schema looks almost like a working one

Worth knowing, because it cost a day. Boot seeders (`addDefaultCities`,
`addDefaultBrands`, …) refill reference data on every start. A **fresh, empty**
`cocarr_core` therefore answers `GET /city` with 40 rows and `GET /vehicle` with
`count: 0` — plausible reference data, zero real rows, no errors anywhere. That
signature means *wrong or empty schema*, not a broken query.

## The real remaining risk: `db.sync({ alter: true })` in production

Not the topology. Every service rewrites its whole schema on every boot, which:

- **drops columns** no longer declared on a model (this is how `panCards.backImageKey` would disappear),
- accumulates duplicate indexes toward MySQL's **64-key-per-table limit**,
- aborts the entire pass on one bad foreign key, leaving later models with no tables.

All three have caused incidents. Moving to real migrations (`umzug`, or
Sequelize CLI) removes more risk than any topology change. Until then, treat
every deploy as a schema rewrite and read the boot log.
