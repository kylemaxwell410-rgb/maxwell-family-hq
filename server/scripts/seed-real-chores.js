// Seed the real Maxwell-family chore loadout. Wipes existing chores and
// chore_completions, inserts the new set, sets per-kid laundry_day, and
// inserts anchor completion rows for interval chores so their cycles start
// from the right point.
//
// Usage:  node server/scripts/seed-real-chores.js
//
// Idempotent — safe to re-run. Leaves point_transactions and points_balance
// alone (points are shelved, not deleted).

import { db, nanoid, initSchema } from '../db.js';

// Ensure migrations have run (laundry_day on kids, interval_days on chores).
// The server's index.js normally does this on boot; running standalone, we
// have to do it ourselves before touching those columns.
initSchema();

function todayStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function dateMinusDays(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return todayStr(d);
}

const TODAY = todayStr();

// --- Laundry days (JS getDay: 0=Sun..6=Sat) ---
const LAUNDRY = {
  Mom: 1,            // Mon
  Dad: 2,            // Tue
  Kolt: 3,           // Wed
  'Michael-ann': 4,  // Thu
  Emma: 5,           // Fri
  Preston: 6,        // Sat
};

// --- Chore loadout. `anchor_days_ago` is only used for `interval` chores;
// it inserts a fake chore_completions row at (today - N) so the next-due
// math starts from the right point. ---
const CHORES = [
  // KOLT
  { kid: 'Kolt', title: '🗑️ Take out trash bags', frequency: 'weekly', days_of_week: '0',
    notes: '3 cans (hallway + ranger). Install fresh bags after.' },
  { kid: 'Kolt', title: '📦 Take out boxes (hallway + ranger)',                    frequency: 'daily',           days_of_week: '0,1,2,3,4,5,6' },
  { kid: 'Kolt', title: '🐾 8am — Feed animals',                                    frequency: 'daily',           days_of_week: '0,1,2,3,4,5,6' },
  { kid: 'Kolt', title: '🦆 9am — Feed ducks',                                      frequency: 'daily',           days_of_week: '0,1,2,3,4,5,6' },
  { kid: 'Kolt', title: '🐱 Feed and water cats',                                   frequency: 'daily',           days_of_week: '0,1,2,3,4,5,6' },
  { kid: 'Kolt', title: '🐱 7pm — Wet food for cats',                               frequency: 'daily',           days_of_week: '0,1,2,3,4,5,6' },
  { kid: 'Kolt', title: '🌿 Cut grass',                                             frequency: 'weekly_rolling',  days_of_week: '0' },
  { kid: 'Kolt', title: '💊 9am — Take supplements',                                frequency: 'daily',           days_of_week: '0,1,2,3,4,5,6' },
  { kid: 'Kolt', title: '💊 9pm — Take supplements',                                frequency: 'daily',           days_of_week: '0,1,2,3,4,5,6' },

  // MICHAEL-ANN
  { kid: 'Michael-ann', title: '🍽️ 9am — Dishes (load + wash)',                    frequency: 'daily',           days_of_week: '0,1,2,3,4,5,6' },
  { kid: 'Michael-ann', title: '🍽️ 7pm — Dishes (load + wash)',                    frequency: 'daily',           days_of_week: '0,1,2,3,4,5,6' },
  { kid: 'Michael-ann', title: '🧹 Tidy kitchen',                                   frequency: 'weekly',          days_of_week: '0,1,3,5' },
  { kid: 'Michael-ann', title: '🐾 Evening — Feed animals',                         frequency: 'weekly',          days_of_week: '2,4,6' },
  { kid: 'Michael-ann', title: '🧼 Clean gerbil cages',                             frequency: 'interval',        days_of_week: '0,1,2,3,4,5,6', interval_days: 10, anchor_days_ago: 9 },
  { kid: 'Michael-ann', title: '💊 Dog meds — heartworm/flea/tick (her dog)',       frequency: 'interval',        days_of_week: '0,1,2,3,4,5,6', interval_days: 30, anchor_days_ago: 2 },
  { kid: 'Michael-ann', title: '💊 9am — Take supplements',                         frequency: 'daily',           days_of_week: '0,1,2,3,4,5,6' },
  { kid: 'Michael-ann', title: '💊 9pm — Take supplements',                         frequency: 'daily',           days_of_week: '0,1,2,3,4,5,6' },

  // EMMA
  { kid: 'Emma', title: '🧹 Tidy kitchen',                                          frequency: 'weekly',          days_of_week: '2,4,6' },
  { kid: 'Emma', title: '🐾 Evening — Feed animals',                                frequency: 'weekly',          days_of_week: '0,1,3,5' },
  { kid: 'Emma', title: '🍽️ 9am — Unload dishwasher + counter dishes',              frequency: 'weekly',          days_of_week: '0,1,3,5' },
  { kid: 'Emma', title: '🍽️ 7pm — Unload dishwasher + counter dishes',              frequency: 'weekly',          days_of_week: '0,1,3,5' },
  { kid: 'Emma', title: '🐹 9am — Feed and water gerbils',                          frequency: 'daily',           days_of_week: '0,1,2,3,4,5,6' },
  { kid: 'Emma', title: '💊 Dog meds — heartworm/flea/tick (her dog)',              frequency: 'interval',        days_of_week: '0,1,2,3,4,5,6', interval_days: 30, anchor_days_ago: 2 },
  { kid: 'Emma', title: '💊 9am — Take supplements',                                frequency: 'daily',           days_of_week: '0,1,2,3,4,5,6' },
  { kid: 'Emma', title: '💊 9pm — Take supplements',                                frequency: 'daily',           days_of_week: '0,1,2,3,4,5,6' },

  // PRESTON  — emoji prefixes to help him recognize chores by sight.
  // Dishwasher: 9am only on Saturday; 7pm on Tue/Thu/Sat. So Tue and Thu
  // are once-daily (7pm only) to lighten his load on those days.
  { kid: 'Preston', title: '🍽️ 9am — Unload dishwasher + counter dishes',           frequency: 'weekly',          days_of_week: '6' },
  { kid: 'Preston', title: '🍽️ 7pm — Unload dishwasher + counter dishes',           frequency: 'weekly',          days_of_week: '2,4,6' },
  { kid: 'Preston', title: '🛋️ Tidy living room',                                   frequency: 'daily',           days_of_week: '0,1,2,3,4,5,6' },
  { kid: 'Preston', title: '🐕 9am — Feed and water dogs',                          frequency: 'daily',           days_of_week: '0,1,2,3,4,5,6' },
  { kid: 'Preston', title: '🐕 6pm — Feed and water dogs',                          frequency: 'daily',           days_of_week: '0,1,2,3,4,5,6' },
  { kid: 'Preston', title: '🐹 Feed and water gerbils',                             frequency: 'daily',           days_of_week: '0,1,2,3,4,5,6' },
  { kid: 'Preston', title: '💊 9am — Take supplements',                             frequency: 'daily',           days_of_week: '0,1,2,3,4,5,6' },
  { kid: 'Preston', title: '💊 9pm — Take supplements',                             frequency: 'daily',           days_of_week: '0,1,2,3,4,5,6' },

  // MOM
  { kid: 'Mom', title: '🌹 Fertilize roses',                                        frequency: 'interval',        days_of_week: '0,1,2,3,4,5,6', interval_days: 42, anchor_days_ago: 42 },

  // DAD
  { kid: 'Dad', title: '❄️ Replace AC filter',                                      frequency: 'interval',        days_of_week: '0,1,2,3,4,5,6', interval_days: 90, anchor_days_ago: 30 },
];

const kids = db.prepare('SELECT id, name FROM kids').all();
const byName = new Map(kids.map(k => [k.name, k.id]));

const missing = CHORES.filter(c => !byName.has(c.kid)).map(c => c.kid);
if (missing.length) {
  console.error('[seed] Missing kid records for:', [...new Set(missing)]);
  console.error('Run the app once first so the kids table is seeded, then re-run this script.');
  process.exit(1);
}

// Match a saved completion to a new chore by (kid_id + title without
// emoji prefix). Lets us preserve check-offs across re-seeds even if we
// add/change emoji prefixes — a full title rewrite still loses the link.
const stripPrefix = (title) => title.replace(/^[^A-Za-z0-9]+/, '').trim();

const tx = db.transaction(() => {
  // 1. Snapshot existing completions BEFORE we wipe chores.
  const savedCompletions = db.prepare(`
    SELECT c.kid_id AS kid_id, c.title AS title,
           cc.completed_date AS completed_date, cc.completed_at AS completed_at
    FROM chore_completions cc
    JOIN chores c ON c.id = cc.chore_id
  `).all();

  const savedByKey = new Map();
  for (const r of savedCompletions) {
    const key = `${r.kid_id}|${stripPrefix(r.title)}`;
    if (!savedByKey.has(key)) savedByKey.set(key, []);
    savedByKey.get(key).push({ completed_date: r.completed_date, completed_at: r.completed_at });
  }
  console.log(`[seed] Snapshotting ${savedCompletions.length} completion record(s) for preservation`);

  // 2. Wipe chores. CASCADE deletes the completions; we'll restore matches below.
  console.log('[seed] Wiping existing chores...');
  db.prepare('DELETE FROM chores').run();

  console.log('[seed] Setting laundry days...');
  const updateLaundry = db.prepare('UPDATE kids SET laundry_day = ? WHERE name = ?');
  for (const [name, day] of Object.entries(LAUNDRY)) {
    updateLaundry.run(day, name);
  }

  // 3. Insert fresh chores. For each one, restore matched completions.
  //    For interval chores, only insert the anchor if no completion was preserved.
  console.log('[seed] Inserting chores...');
  const insertChore = db.prepare(
    `INSERT INTO chores (id, kid_id, title, points, frequency, days_of_week, active, sort_order, interval_days, notes)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`
  );
  const insertCompletion = db.prepare(
    `INSERT INTO chore_completions (id, chore_id, completed_date, completed_at)
     VALUES (?, ?, ?, ?)`
  );

  let order = 0;
  let restored = 0;
  for (const c of CHORES) {
    const id = nanoid();
    const kid_id = byName.get(c.kid);
    insertChore.run(
      id,
      kid_id,
      c.title,
      0,                            // points shelved
      c.frequency,
      c.days_of_week,
      order++,
      c.interval_days ?? null,
      c.notes ?? null
    );

    const matchKey = `${kid_id}|${stripPrefix(c.title)}`;
    const preserved = savedByKey.get(matchKey) || [];
    for (const p of preserved) {
      insertCompletion.run(nanoid(), id, p.completed_date, p.completed_at);
      restored++;
    }

    if (c.frequency === 'interval' && c.anchor_days_ago != null && preserved.length === 0) {
      const anchorDate = dateMinusDays(c.anchor_days_ago);
      insertCompletion.run(nanoid(), id, anchorDate, anchorDate + 'T12:00:00.000Z');
      console.log(`  [interval-anchor] ${c.kid} — ${c.title} → anchored at ${anchorDate} (${c.anchor_days_ago}d ago, every ${c.interval_days}d)`);
    } else if (c.frequency === 'interval' && preserved.length > 0) {
      console.log(`  [interval — ${preserved.length} completion(s) preserved] ${c.kid} — ${c.title}`);
    } else if (preserved.length > 0) {
      console.log(`  [${c.frequency} — ${preserved.length} completion(s) preserved] ${c.kid} — ${c.title}`);
    } else {
      console.log(`  [${c.frequency}] ${c.kid} — ${c.title}`);
    }
  }
  console.log(`[seed] Restored ${restored} completion record(s) onto the new chore IDs.`);
});

tx();
console.log('[seed] Done. Today is', TODAY, '— restart the server to pick up new chores.');
