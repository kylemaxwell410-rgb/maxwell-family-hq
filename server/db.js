import { nanoid } from 'nanoid';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'data.db');

// Primary driver: better-sqlite3 (native, fast, used on the Pi).
// Fallback: node:sqlite (built into Node 22+) — used on dev machines
// where better-sqlite3 couldn't build (e.g. Mac without Xcode CLT).
async function openDb() {
  try {
    const { default: Database } = await import('better-sqlite3');
    const d = new Database(DB_PATH);
    d.pragma('journal_mode = WAL');
    d.pragma('foreign_keys = ON');
    console.log('[db] using better-sqlite3');
    return d;
  } catch (e) {
    const { DatabaseSync } = await import('node:sqlite');
    const raw = new DatabaseSync(DB_PATH);
    raw.exec('PRAGMA journal_mode = WAL');
    raw.exec('PRAGMA foreign_keys = ON');
    console.log('[db] using node:sqlite fallback (better-sqlite3 not available:', e.code || e.message, ')');
    // Shim node:sqlite to match the better-sqlite3 surface we use.
    return {
      prepare: (sql) => raw.prepare(sql),
      exec: (sql) => raw.exec(sql),
      pragma: (stmt) => raw.exec('PRAGMA ' + stmt),
      transaction: (fn) => (...args) => {
        raw.exec('BEGIN');
        try {
          const r = fn(...args);
          raw.exec('COMMIT');
          return r;
        } catch (err) {
          try { raw.exec('ROLLBACK'); } catch {}
          throw err;
        }
      },
      close: () => raw.close(),
    };
  }
}

export const db = await openDb();

export function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS kids (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      initials TEXT NOT NULL,
      color TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      points_balance INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS chores (
      id TEXT PRIMARY KEY,
      kid_id TEXT NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      points INTEGER NOT NULL DEFAULT 1,
      frequency TEXT NOT NULL DEFAULT 'daily',
      days_of_week TEXT NOT NULL DEFAULT '0,1,2,3,4,5,6',
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS chore_completions (
      id TEXT PRIMARY KEY,
      chore_id TEXT NOT NULL REFERENCES chores(id) ON DELETE CASCADE,
      completed_date TEXT NOT NULL,
      completed_at TEXT NOT NULL,
      UNIQUE(chore_id, completed_date)
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      start_datetime TEXT NOT NULL,
      end_datetime TEXT,
      kid_id TEXT REFERENCES kids(id) ON DELETE SET NULL,
      notes TEXT,
      all_day INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS meals (
      id TEXT PRIMARY KEY,
      meal_date TEXT NOT NULL,
      meal_type TEXT NOT NULL,
      description TEXT,
      UNIQUE(meal_date, meal_type)
    );

    CREATE TABLE IF NOT EXISTS shopping_items (
      id TEXT PRIMARY KEY,
      item TEXT NOT NULL,
      category TEXT,
      checked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS point_transactions (
      id TEXT PRIMARY KEY,
      kid_id TEXT NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
      amount INTEGER NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_chores_kid ON chores(kid_id);
    CREATE INDEX IF NOT EXISTS idx_completions_date ON chore_completions(completed_date);
    CREATE INDEX IF NOT EXISTS idx_events_start ON events(start_datetime);
    CREATE INDEX IF NOT EXISTS idx_meals_date ON meals(meal_date);
    CREATE INDEX IF NOT EXISTS idx_txn_kid ON point_transactions(kid_id);
  `);

  // Idempotent migration: add role column if it doesn't exist.
  try {
    db.prepare('SELECT role FROM kids LIMIT 1').get();
  } catch {
    db.exec("ALTER TABLE kids ADD COLUMN role TEXT NOT NULL DEFAULT 'kid'");
    console.log('[db] added role column to kids');
  }

  // Idempotent migration: add birthday column (TEXT, nullable; "MM-DD" or "YYYY-MM-DD").
  try {
    db.prepare('SELECT birthday FROM kids LIMIT 1').get();
  } catch {
    db.exec('ALTER TABLE kids ADD COLUMN birthday TEXT');
    console.log('[db] added birthday column to kids');
  }

  // Idempotent migration: add bedtime column (TEXT, "HH:MM" 24h, nullable).
  try {
    db.prepare('SELECT bedtime FROM kids LIMIT 1').get();
  } catch {
    db.exec('ALTER TABLE kids ADD COLUMN bedtime TEXT');
    console.log('[db] added bedtime column to kids');
  }

  // Family notes
  db.exec(`
    CREATE TABLE IF NOT EXISTS family_notes (
      id TEXT PRIMARY KEY,
      body TEXT NOT NULL,
      expires_on TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // Vacations: trips with a location and date range.
  db.exec(`
    CREATE TABLE IF NOT EXISTS vacations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      location TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_vacations_start ON vacations(start_date);
  `);

  // Bot Q&A audit log: every kid question + Claude's answer for parent visibility.
  db.exec(`
    CREATE TABLE IF NOT EXISTS bot_messages (
      id TEXT PRIMARY KEY,
      kid_name TEXT,
      question TEXT NOT NULL,
      answer TEXT,
      error TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_bot_messages_created ON bot_messages(created_at);
  `);

  // Family-wide settings (bedtime, future bot key, etc.).
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
  // Seed defaults if not present.
  const seedSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  seedSetting.run('bedtime', '20:45'); // 8:45 PM, family-wide
}

const SEED_KIDS = [
  { id: 'kolt',        name: 'Kolt',        initials: 'K',  color: '#EF4444', sort_order: 1, role: 'kid',    birthday: '02-07' },
  { id: 'michaelann',  name: 'Michael-ann', initials: 'MA', color: '#EC4899', sort_order: 2, role: 'kid',    birthday: '01-29' },
  { id: 'emma',        name: 'Emma',        initials: 'E',  color: '#22C55E', sort_order: 3, role: 'kid',    birthday: '02-14' },
  { id: 'preston',     name: 'Preston',     initials: 'P',  color: '#185FA5', sort_order: 4, role: 'kid',    birthday: '11-25' },
  { id: 'mom',         name: 'Mom',         initials: 'M',  color: '#14B8A6', sort_order: 5, role: 'parent', birthday: '08-15' },
  { id: 'dad',         name: 'Dad',         initials: 'D',  color: '#6B7280', sort_order: 6, role: 'parent', birthday: '04-10' },
  { id: 'jack',        name: 'Jack',        initials: 'J',  color: '#A0522D', sort_order: 7, role: 'pet',    birthday: '12-01' },
  { id: 'shadow',      name: 'Shadow',      initials: 'S',  color: '#475569', sort_order: 8, role: 'pet',    birthday: '12-01' },
];

const SEED_CHORES = {
  kolt: [
    { title: 'Feed horses AM',    points: 5 },
    { title: 'Chicken coop check', points: 3 },
    { title: 'Make bed',          points: 2 },
    { title: 'Homework',          points: 5 },
  ],
  michaelann: [
    { title: 'Feed dogs',          points: 3 },
    { title: 'Unload dishwasher',  points: 4 },
    { title: 'Make bed',           points: 2 },
    { title: 'Homework',           points: 5 },
  ],
  emma: [
    { title: 'Feed cats',  points: 3 },
    { title: 'Tidy room',  points: 3 },
    { title: 'Set table',  points: 2 },
    { title: 'Homework',   points: 5 },
  ],
  preston: [
    { title: 'Put toys away',       points: 2 },
    { title: 'Help feed chickens',  points: 3 },
    { title: 'Make bed',            points: 2 },
  ],
};

export function seedIfEmpty() {
  const row = db.prepare('SELECT COUNT(*) AS c FROM kids').get();
  const empty = row.c === 0;

  const insertKid = db.prepare(
    'INSERT INTO kids (id, name, initials, color, sort_order, points_balance, role, birthday) VALUES (?, ?, ?, ?, ?, 0, ?, ?)'
  );
  const insertChore = db.prepare(
    `INSERT INTO chores (id, kid_id, title, points, frequency, days_of_week, active, sort_order)
     VALUES (?, ?, ?, ?, 'daily', '0,1,2,3,4,5,6', 1, ?)`
  );

  if (empty) {
    const tx = db.transaction(() => {
      for (const k of SEED_KIDS) {
        insertKid.run(k.id, k.name, k.initials, k.color, k.sort_order, k.role, k.birthday);
        const chores = SEED_CHORES[k.id] || [];
        chores.forEach((c, i) => {
          insertChore.run(nanoid(), k.id, c.title, c.points, i + 1);
        });
      }
    });
    tx();
    console.log('[db] Seeded', SEED_KIDS.length, 'family members and starter chores');
    return;
  }

  // Non-empty DB: add any seed members who don't exist yet (e.g. Mom/Dad/pets on an older install).
  const existing = new Set(
    db.prepare('SELECT id FROM kids').all().map(r => r.id)
  );
  const missing = SEED_KIDS.filter(k => !existing.has(k.id));
  if (missing.length > 0) {
    const tx = db.transaction(() => {
      for (const k of missing) {
        insertKid.run(k.id, k.name, k.initials, k.color, k.sort_order, k.role, k.birthday);
      }
    });
    tx();
    console.log('[db] Added new family members:', missing.map(m => m.name).join(', '));
  }

  // Back-fill birthdays for seeded members where the DB has them as NULL.
  // Respects manual overrides — only fills NULLs.
  const fillBirthday = db.prepare('UPDATE kids SET birthday = ? WHERE id = ? AND birthday IS NULL');
  const tx2 = db.transaction(() => {
    for (const k of SEED_KIDS) {
      if (k.birthday) fillBirthday.run(k.birthday, k.id);
    }
  });
  tx2();
}

// Re-apply the seed colors on every boot so color adjustments ship via git.
// Only runs for seeded people (by id); user-added family members are untouched.
// Respects admin edits: only updates if the color is still the *previous* seeded color
// (tracked via this table of historical defaults), so a user override via Admin sticks.
const PREVIOUS_COLORS = {
  kolt:       ['#185FA5', '#C43E3E'], // blue → muted red → bright red
  preston:    ['#0F6E56'],            // teal → blue
  mom:        ['#0F6E56'],            // green → teal
  michaelann: ['#993556'],            // magenta → pink
  emma:       ['#534AB7'],            // purple → green
};

export function applySeedColorUpdates() {
  const getColor = db.prepare('SELECT color FROM kids WHERE id = ?');
  const update   = db.prepare('UPDATE kids SET color = ? WHERE id = ?');
  const tx = db.transaction(() => {
    for (const k of SEED_KIDS) {
      const row = getColor.get(k.id);
      if (!row) continue;
      const prev = PREVIOUS_COLORS[k.id] || [];
      // Update only if the current color is a known-old default (so custom admin colors stay).
      if (row.color !== k.color && prev.includes(row.color)) {
        update.run(k.color, k.id);
        console.log(`[db] recolored ${k.id}: ${row.color} → ${k.color}`);
      }
    }
  });
  tx();
}

export { nanoid };
