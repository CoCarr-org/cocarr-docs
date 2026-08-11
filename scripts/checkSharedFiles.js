#!/usr/bin/env node
// Verifies the files COPIED across services are still identical.
//
//   node scripts/checkSharedFiles.js          # report drift
//   node scripts/checkSharedFiles.js --fix    # copy the reference over the others
//
// WHY A CHECK AND NOT A SHARED PACKAGE.
//
// Extracting these into `@cocarr/service-kit` was the first instinct and is the
// textbook answer, but it is the wrong trade here: a private cross-repo
// dependency means every service's `npm ci` needs GitHub credentials at build
// time, and the Railway builds run without them. That adds a new build-failure
// mode to five services in order to deduplicate four small files — and every
// change to the kit then needs a version bump landed in five repos before it
// takes effect anywhere.
//
// The real risk was never the duplication. It is DRIFT: five copies that are
// identical today, and quietly stop being identical the first time somebody
// fixes a bug in one of them. This makes that visible in one command, costs
// nothing at build time, and can be deleted the day a package registry exists.
//
// It works because the platform is checked out side by side — the same layout
// every developer here already has:
//
//     Resdesign/
//       cocarr-core-api/
//       cocarr-identity-service/
//       ...
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '../..');
const fix = process.argv.includes('--fix');

// The REFERENCE copy is identity-service: it is where each of these was written
// and verified first, so it is the one to copy FROM rather than an arbitrary
// winner.
const REFERENCE = 'cocarr-identity-service';

const SERVICES = [
  'cocarr-identity-service',
  'cocarr-notification-service',
  'cocarr-workspace-api',
  'cocarr-authorization-service',
  'cocarr-core-api',
];

// Files that must be byte-identical everywhere they exist. A service that does
// not have one is skipped, not failed — core-api has no apiVersions until it
// adopts versioning, and that is a legitimate state.
const SHARED = [
  'src/configs/dbPreflight.js',
  'src/db/migrator.js',
  'scripts/migrate.js',
  'scripts/ensureDatabase.js',
  'src/routes/apiVersions.js',
];

// Lines that are SUPPOSED to differ per service. Comparing them would report
// noise forever and train everyone to ignore the check.
const PER_SERVICE = [
  /service: 'cocarr-[a-z-]+'/,          // apiVersions identifies its own service
  /cocarr-[a-z-]+-(service|api)/,        // names in comments and log lines
  /--service [a-z]+/,                    // railway service name in the workflow
  // Each service names ITS OWN schema step in ensureDatabase's closing hint —
  // syncTables for IAM, initSchema for core-api, "restart" for the rest. That
  // is deliberate and useful; comparing it would report drift forever.
  /run the schema step next[^']*/,
  /node scripts\/(syncTables|initSchema)\.js[^']*/,
];

const canonical = (text) => {
  let out = text;
  PER_SERVICE.forEach((re) => { out = out.replace(new RegExp(re, 'g'), '<SERVICE>'); });
  return out;
};

const hash = (text) => crypto.createHash('sha256').update(canonical(text)).digest('hex').slice(0, 12);

const read = (svc, file) => {
  const p = path.join(ROOT, svc, file);
  return fs.existsSync(p) ? { path: p, text: fs.readFileSync(p, 'utf8') } : null;
};

let drifted = 0;
let checked = 0;

for (const file of SHARED) {
  const ref = read(REFERENCE, file);
  if (!ref) {
    console.log(`  SKIP  ${file}  (not present in the reference, ${REFERENCE})`);
    continue;
  }
  const refHash = hash(ref.text);
  const others = SERVICES.filter((s) => s !== REFERENCE);
  const mismatched = [];

  for (const svc of others) {
    const copy = read(svc, file);
    if (!copy) continue; // legitimately absent
    checked += 1;
    if (hash(copy.text) !== refHash) mismatched.push({ svc, copy });
  }

  if (!mismatched.length) {
    console.log(`  ok    ${file}`);
    continue;
  }

  drifted += mismatched.length;
  console.log(`  DRIFT ${file}`);
  mismatched.forEach(({ svc, copy }) => {
    console.log(`          ${svc}  (${hash(copy.text)} != ${refHash})`);
    if (fix) {
      // Preserve the per-service substitutions rather than overwriting them
      // with the reference's own service name.
      let next = ref.text;
      const name = svc.replace(/^cocarr-/, 'cocarr-');
      next = next.replace(new RegExp(REFERENCE, 'g'), name);
      fs.writeFileSync(copy.path, next);
      console.log('          -> overwritten from the reference');
    }
  });
}

console.log(
  drifted
    ? `\n${drifted} copy(ies) have drifted from ${REFERENCE}.`
      + (fix ? ' Fixed — review the diff before committing.' : ' Re-run with --fix, or reconcile by hand.')
    : `\nNo drift. ${checked} copies match the reference.`,
);
process.exit(drifted && !fix ? 1 : 0);
