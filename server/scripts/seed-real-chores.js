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
  { kid: 'Kolt', title: 'Take out trash bags', frequency: 'weekly', days_of_week: '0',
    notes: '3 cans (hallway + ranger). Install fresh bags after.' },
  { kid: 'Kolt', title: 'Take out boxes (hallway + ranger)',                       frequency: 'daily',           days_of_week: '0,1,2,3,4,5,6' },
  { kid: 'Kolt', title: 'Feed animals — 8am',                                      frequency: 'daily',           days_of_week: '0,1,2,3,4,5,6' },
  { kid: 'Kolt', title: 'Feed cats',                                               frequency: 'daily',           days_of_week: '0,1,2,3,4,5,6' },
  { kid: 'Kolt', title: 'Cut grass',                                               frequency: 'weekly_rolling',  days_of_week: '0' },

  // MICHAEL-ANN
  { kid: 'Michael-ann', title: 'Dishes (load + wash) — 12pm',                      frequency: 'daily',           days_of_week: '0,1,2,3,4,5,6' },
  { kid: 'Michael-ann', title: 'Dishes (load + wash) — 7pm',                       frequency: 'daily',           days_of_week: '0,1,2,3,4,5,6' },
  { kid: 'Michael-ann', title: 'Tidy kitchen',                                     frequency: 'weekly',          days_of_week: '0,1,3,5' },
  { kid: 'Michael-ann', title: 'Feed animals — evening',                           frequency: 'weekly',          days_of_week: '2,4,6' },
  { kid: 'Michael-ann', title: 'Clean gerbil cages',                               frequency: 'interval',        days_of_week: '0,1,2,3,4,5,6', interval_days: 10, anchor_days_ago: 10 },
  { kid: 'Michael-ann', title: 'Dog meds — heartworm/flea/tick (her dog)',         frequency: 'interval',        days_of_week: '0,1,2,3,4,5,6', interval_days: 30, anchor_days_ago: 2 },

  // EMMA
  { kid: 'Emma', title: 'Tidy kitchen',                                            frequency: 'weekly',          days_of_week: '2,4,6' },
  { kid: 'Emma', title: 'Feed animals — evening',                                  frequency: 'weekly',          days_of_week: '0,1,3,5' },
  { kid: 'Emma', title: 'Unload dishwasher + counter dishes — 9am',                frequency: 'weekly',          days_of_week: '0,1,3,5' },
  { kid: 'Emma', title: 'Unload dishwasher + counter dishes — 7pm',                frequency: 'weekly',          days_of_week: '0,1,3,5' },
  { kid: 'Emma', title: 'Feed + water gerbils — 9am',                              frequency: 'daily',           days_of_week: '0,1,2,3,4,5,6' },
  { kid: 'Emma', title: 'Dog meds — heartworm/flea/tick (her dog)',                frequency: 'interval',        days_of_week: '0,1,2,3,4,5,6', interval_days: 30, anchor_days_ago: 2 },

  // PRESTON
  { kid: 'Preston', title: 'Unload dishwasher + counter dishes — 9am',             frequency: 'weekly',          days_of_week: '2,4,6' },
  { kid: 'Preston', title: 'Unload dishwasher + counter dishes — 7pm',             frequency: 'weekly',          days_of_week: '2,4,6' },
  { kid: 'Preston', title: 'Tidy living room',                                     frequency: 'daily',           days_of_week: '0,1,2,3,4,5,6' },
  { kid: 'Preston', title: 'Feed dogs — 9am',                                      frequency: 'daily',           days_of_week: '0,1,2,3,4,5,6' },
  { kid: 'Preston', title: 'Feed dogs — 6pm',                                      frequency: 'daily',           days_of_week: '0,1,2,3,4,5,6' },
  { kid: 'Preston', title: 'Feed gerbil',                                          frequency: 'daily',           days_of_week: '0,1,2,3,4,5,6' },

  // MOM
  { kid: 'Mom', title: 'Fertilize roses',                                          frequency: 'interval',        days_of_week: '0,1,2,3,4,5,6', interval_days: 42, anchor_days_ago: 42 },

  // DAD
  { kid: 'Dad', title: 'Replace AC filter',                                        frequency: 'interval',        days_of_week: '0,1,2,3,4,5,6', interval_days: 90, anchor_days_ago: 30 },
];

const kids = db.prepare('SELECT id, name FROM kids').all();
const byName = new Map(kids.map(k => [k.name, k.id]));

const missing = CHORES.filter(c => !byName.has(c.kid)).map(c => c.kid);
if (missing.length) {
  console.error('[seed] Missing kid records for:', [...new Set(missing)]);
  console.error('Run the app once first so the kids table is seeded, then re-run this script.');
  process.exit(1);
}

const tx = db.transaction(() => {
  console.log('[seed] Wiping existing chores and chore_completions...');
  db.prepare('DELETE FROM chore_completions').run();
  db.prepare('DELETE FROM chores').run();

  console.log('[seed] Setting laundry days...');
  const updateLaundry = db.prepare('UPDATE kids SET laundry_day = ? WHERE name = ?');
  for (const [name, day] of Object.entries(LAUNDRY)) {
    updateLaundry.run(day, name);
  }

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
  for (const c of CHORES) {
    const id = nanoid();
    insertChore.run(
      id,
      byName.get(c.kid),
      c.title,
      0,                            // points shelved
      c.frequency,
      c.days_of_week,
      order++,
      c.interval_days ?? null,
      c.notes ?? null
    );

    if (c.frequency === 'interval' && c.anchor_days_ago != null) {
      const anchorDate = dateMinusDays(c.anchor_days_ago);
      insertCompletion.run(
        nanoid(),
        id,
        anchorDate,
        anchorDate + 'T12:00:00.000Z'
      );
      console.log(`  [interval-anchor] ${c.kid} — ${c.title} → anchored at ${anchorDate} (${c.anchor_days_ago}d ago, every ${c.interval_days}d)`);
    } else {
      console.log(`  [${c.frequency}] ${c.kid} — ${c.title}`);
    }
  }
});

tx();
console.log('[seed] Done. Today is', TODAY, '— restart the server to pick up new chores.');
