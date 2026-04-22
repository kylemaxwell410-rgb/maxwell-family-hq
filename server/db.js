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
}

const SEED_KIDS = [
  { id: 'kolt',        name: 'Kolt',        initials: 'K',  color: '#185FA5', sort_order: 1 },
  { id: 'michaelann',  name: 'Michael-ann', initials: 'MA', color: '#993556', sort_order: 2 },
  { id: 'emma',        name: 'Emma',        initials: 'E',  color: '#534AB7', sort_order: 3 },
  { id: 'preston',     name: 'Preston',     initials: 'P',  color: '#0F6E56', sort_order: 4 },
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
  if (row.c > 0) return;

  const insertKid = db.prepare(
    'INSERT INTO kids (id, name, initials, color, sort_order, points_balance) VALUES (?, ?, ?, ?, ?, 0)'
  );
  const insertChore = db.prepare(
    `INSERT INTO chores (id, kid_id, title, points, frequency, days_of_week, active, sort_order)
     VALUES (?, ?, ?, ?, 'daily', '0,1,2,3,4,5,6', 1, ?)`
  );

  const tx = db.transaction(() => {
    for (const k of SEED_KIDS) {
      insertKid.run(k.id, k.name, k.initials, k.color, k.sort_order);
      const chores = SEED_CHORES[k.id] || [];
      chores.forEach((c, i) => {
        insertChore.run(nanoid(), k.id, c.title, c.points, i + 1);
      });
    }
  });
  tx();
  console.log('[db] Seeded 4 kids and starter chores');
}

export { nanoid };
