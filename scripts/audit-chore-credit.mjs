// Read-only audit: find chore completions whose paired point_transaction was
// credited to a kid different from the one creditedKidId() would pick today.
//
// Caveat: this re-derives credit using the *current* chores.kid_id and
// chores.alternate_kids — chore config that changes after a completion will
// produce false positives. Use the report as an investigation starting point,
// not a rewrite blueprint.
//
// Usage (on the Pi):
//   cd ~/maxwell-family-hq && node scripts/audit-chore-credit.mjs
// Optional: pass a DB path:
//   node scripts/audit-chore-credit.mjs ./server/data.db

import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const dbPath = process.argv[2] || path.join(__dirname, '..', 'server', 'data.db');
const db = new Database(dbPath, { readonly: true });

function alternateOwnerId(altCsv, dateStr) {
  if (!altCsv) return null;
  const ids = altCsv.split(',').map((s) => s.trim()).filter(Boolean);
  if (!ids.length) return null;
  const days = Math.floor(new Date(dateStr + 'T12:00:00').getTime() / 86400000);
  return ids[((days % ids.length) + ids.length) % ids.length];
}

function creditedKidId(chore, date) {
  const ov = db.prepare(
    'SELECT kid_id FROM chore_overrides WHERE chore_id = ? AND override_date = ?',
  ).get(chore.id, date);
  if (ov?.kid_id) return ov.kid_id;
  if (chore.frequency === 'alternate_daily') {
    return alternateOwnerId(chore.alternate_kids, date) || chore.kid_id;
  }
  return chore.kid_id;
}

const kidName = new Map(
  db.prepare('SELECT id, name FROM kids').all().map((k) => [k.id, k.name]),
);

// All completions, joined to current chore config + the point_transaction row
// created at the same moment. Match by `reason = 'Completed: <title>'` and
// timestamp within 1 second.
const rows = db.prepare(`
  SELECT cc.id AS completion_id, cc.chore_id, cc.completed_date, cc.completed_at,
         c.title, c.points, c.frequency, c.alternate_kids, c.kid_id AS owner_kid_id,
         pt.id AS pt_id, pt.kid_id AS pt_kid_id, pt.amount, pt.created_at AS pt_at
  FROM chore_completions cc
  JOIN chores c ON c.id = cc.chore_id
  LEFT JOIN point_transactions pt
    ON pt.reason = 'Completed: ' || c.title
   AND abs(strftime('%s', pt.created_at) - strftime('%s', cc.completed_at)) <= 1
  ORDER BY cc.completed_date, cc.completed_at
`).all();

let total = 0;
let unmatched = 0;
let mismatched = 0;
const mismatches = [];

for (const r of rows) {
  total++;
  if (!r.pt_id) {
    unmatched++;
    continue;
  }
  const expected = creditedKidId(
    { id: r.chore_id, kid_id: r.owner_kid_id, frequency: r.frequency, alternate_kids: r.alternate_kids },
    r.completed_date,
  );
  if (expected !== r.pt_kid_id) {
    mismatched++;
    mismatches.push({
      date: r.completed_date,
      title: r.title,
      points: r.amount,
      credited: kidName.get(r.pt_kid_id) || r.pt_kid_id,
      expected: kidName.get(expected) || expected,
    });
  }
}

console.log(`Chore-credit audit (DB: ${dbPath})\n`);
console.log(`  Completions scanned:      ${total}`);
console.log(`  Without point_transaction: ${unmatched}`);
console.log(`  Credit mismatches:         ${mismatched}\n`);

if (mismatches.length) {
  console.log('Mismatches (most recent first):');
  for (const m of mismatches.slice(-40).reverse()) {
    console.log(`  ${m.date}  ${m.points}pt  "${m.title}"  credited=${m.credited}  expected=${m.expected}`);
  }
  if (mismatches.length > 40) {
    console.log(`  … ${mismatches.length - 40} more rows`);
  }
} else {
  console.log('No mismatches found.');
}

db.close();
