# Releases, migrations and API versions

How a change gets from a laptop to production without losing data, and how old
clients keep working while new ones move on.

This replaces `db.sync({ alter: true })`, which is not a migration system: it
drops any column no longer declared on a model, aborts its whole pass on one bad
foreign key (leaving later models with no tables), accumulates indexes toward
MySQL's 64-key limit, and does all of it implicitly on every boot. Three
separate incidents in this platform trace to it.

---

## 1. The schema is versioned files

Every schema change is a file in `migrations/`, applied once, in order, recorded
in a `schemaMigrations` table inside that service's own schema.

```bash
npm run migrate:status     # what is applied, what is pending
npm run migrate:up         # apply everything pending
npm run migrate:down       # roll back exactly ONE
npm run migrate:check      # exit 1 if anything is pending  (CI gate)
```

**Migrations use the QueryInterface, never a model.** Models describe the
*current* shape; a migration must describe the shape at *its* point in history.
Import a model into a migration and replaying it a year later builds whatever
the models happen to say then — which is not what ran the first time.

### The baseline

Migration #1 per service is "the schema as it stood when migrations were
adopted". It creates each table **only if absent**, because two databases must
both end up correct:

| Environment | State | What the baseline does |
|---|---|---|
| a fresh database | no tables | creates them |
| every existing environment | tables already built by alter-sync | creates nothing, records itself as applied |

Recording it either way is the correct claim — *the schema is at least at
baseline* — and it makes the file safe to run against dev, staging and
production alike.

**The baseline's `down()` deliberately throws.** Rolling it back drops every
table in the service. No pipeline should reach that by running `migrate:down`
one step too many.

---

## 2. Changing a column without losing data: expand / contract

The rule: **at every moment the schema must work with both the currently-deployed
code and the code about to deploy**, because during a rolling deploy both are
running at once.

| Phase | Release | Action |
|---|---|---|
| **Expand** | N | add the column **nullable**, no default old rows must satisfy |
| **Backfill** | N | populate existing rows (migration or job) |
| **Dual-write** | N | new code writes both shapes |
| **Contract** | **N+1** | add `NOT NULL` / drop the superseded column |

Doing expand and contract in one release is the classic outage: the moment you
add `NOT NULL`, every old container still writing without that column starts
failing inserts.

**A rename is never `renameColumn` alone.** That is one atomic change old and new
code cannot both agree on. It is expand → backfill → dual-write → contract,
across two releases.

**A `down()` that drops a column must refuse when the column has data.** Rollback
happens in exactly the window where that column is new — a guard turns a silent
data loss into a refusal:

```
Refusing to drop identities.locale — 1 row(s) have a value.
Rolling back would destroy them.
```

---

## 3. dev → staging → production

Migrations run as a **release step**, never at boot. Two reasons:

1. **Replicas race.** Two containers starting together issue the same DDL
   concurrently. MySQL DDL is not transactional; you get a half-applied change
   and no way to tell which won.
2. **A failed migration must fail the deploy**, keeping the previous container
   serving. A service that boots anyway runs new code against an old schema —
   worse than being down, because it looks healthy.

```
  merge to develop ──▶ STAGING   migrate ─▶ deploy ─▶ verify
  publish a release ─▶ PRODUCTION  (approval) migrate ─▶ deploy ─▶ verify
```

`.github/workflows/release.yml` implements this. The order is
**plan → backup → migrate → deploy → verify**, with `concurrency` preventing two
releases to one environment and a GitHub Environment approval gate on
production.

Boot no longer changes the schema. It only **reports drift**:

```
!!! PENDING MIGRATIONS — THIS REVISION IS RUNNING AGAINST AN OLD SCHEMA !!!
  pending (2): 20260812000000-baseline.js, 20260812010000-add-identity-locale.js
  Run `npm run migrate:up` as a release step BEFORE this revision takes traffic.
```

`DB_SYNC=true` still allows `sync({alter:true})` for local development, and is
refused in production.

### Before a production migration

1. **Snapshot the database.** A migration is the one deploy step redeploying the
   previous image cannot undo.
2. Run `migrate:status` against production and read the plan.
3. Rehearse on a **restored copy of production**, not on staging — staging's
   data volume and history are not production's, and the failures that matter
   (64-key limit, FK mismatches, long `ALTER TABLE` locks on big tables) only
   appear at real size.

---

## 4. API versions

**URI versioning** (`/v1/...`), chosen because the gateway already routes by path
prefix, the mobile clients are long-lived (an app installed today may still call
this service in two years), and a version in a URL is one you can count in an
access log before removing it.

**Versions share services and models, and differ only in their router and
serialisation.** The moment two versions have separate business logic you are
maintaining two products, every bug is fixed twice, and they drift. *A version is
a presentation contract.*

`src/routes/apiVersions.js` is the registry. Adding a version is one entry:

```js
{ version: 'v2', status: 'current', router: () => require('./v2/rootRouter') }
```

| Status | Behaviour |
|---|---|
| `current` | what new integrations should use |
| `deprecated` | fully works; sends `Deprecation: true`, `Sunset: <date>`, `Link: …` |
| `sunset` | **410 Gone**, naming its successor |

The headers are RFC 9745 (`Deprecation`) and RFC 8594 (`Sunset`), so a client
team detects it is on borrowed time from its own monitoring rather than from an
email nobody read. `GET /versions` returns the machine-readable inventory.

A sunset version answers **410, not 404** — a 404 is indistinguishable from a
typo and sends the caller looking for a bug in their own URL construction.

### When a breaking change needs a new version

Only when the **response contract** breaks: a field removed or retyped, a status
code changed, a required request field added. Additive changes — a new optional
field, a new endpoint — do **not** need one, and minting a version for them
means maintaining forever what you could have added for free.

---

## 5. Adopting this in the remaining services

`cocarr-identity-service` is the reference implementation (3 models — smallest
blast radius). Per service:

1. `npm i umzug@3`
2. Copy `src/db/migrator.js` and `scripts/migrate.js` unchanged.
3. Write the baseline: one `createTable` per model, each guarded by
   `if (!have.has(table))`, **transcribed from the models as they are today** —
   not imported from them.
4. Replace the boot `db.sync({alter:true})` with the drift report.
5. Add the npm scripts and `.github/workflows/release.yml`.
6. Verify against a scratch database restored from that environment, in this
   order: fresh → existing-with-data → a column change → rollback → rollback
   refused when populated.

Order: identity (3 models) ✅ → notification (2) → workspace (12) → IAM (21) →
core-api (77) last, because it is the largest and has the most legacy columns
that alter-sync may already have dropped.

### Keeping the copied files in step

`dbPreflight.js`, `migrator.js`, `migrate.js`, `ensureDatabase.js` and
`apiVersions.js` are **copied** into each service, not shared.

Extracting them into an `@cocarr/service-kit` package was the first instinct and
is the textbook answer, but it is the wrong trade here: a private cross-repo
dependency means every service's `npm ci` needs GitHub credentials at build
time, and the Railway builds run without them. That adds a new build-failure
mode to five services in order to deduplicate five small files — and every fix
to the kit would then need a version bump landed in five repos before it took
effect anywhere.

The real risk was never the duplication. It is **drift**: five copies that are
identical today and quietly stop being identical the first time somebody fixes a
bug in one of them. So:

```bash
node cocarr-docs/scripts/checkSharedFiles.js          # report drift
node cocarr-docs/scripts/checkSharedFiles.js --fix    # copy the reference over the rest
```

It runs across the side-by-side checkout every developer here already has, costs
nothing at build time, and normalises the lines that are *supposed* to differ per
service (the service name, the Railway service, and each service's own schema-step
hint) so it does not report noise forever.

`cocarr-identity-service` is the reference copy — it is where each of these was
written and verified first.

Delete this script the day a package registry exists and the kit becomes worth
its cost.
