import { Router } from 'express';
import { db, nanoid } from '../db.js';

const router = Router();

const PIN = process.env.ADMIN_PIN || '1234';

function requirePin(req, res, next) {
  const sent = req.headers['x-admin-pin'] || req.body?.pin;
  if (sent !== PIN) return res.status(401).json({ error: 'Invalid PIN' });
  next();
}

router.post('/verify', (req, res) => {
  const { pin } = req.body || {};
  if (pin === PIN) return res.json({ ok: true });
  res.status(401).json({ error: 'Invalid PIN' });
});

// -- KIDS --
router.put('/kids/:id', requirePin, (req, res) => {
  const row = db.prepare('SELECT * FROM kids WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const { name, initials, color, sort_order, role, birthday, laundry_day } = req.body || {};
  // birthday: '' clears it; undefined leaves it; 'MM-DD' or 'YYYY-MM-DD' sets it.
  const nextBirthday =
    birthday === undefined ? row.birthday :
    birthday === '' ? null :
    birthday;
  // laundry_day: '' or null clears; undefined leaves; 0-6 sets.
  const nextLaundryDay =
    laundry_day === undefined ? row.laundry_day :
    (laundry_day === '' || laundry_day === null) ? null :
    Number(laundry_day);
  db.prepare(
    'UPDATE kids SET name = ?, initials = ?, color = ?, sort_order = ?, role = ?, birthday = ?, laundry_day = ? WHERE id = ?'
  ).run(
    name ?? row.name,
    initials ?? row.initials,
    color ?? row.color,
    sort_order ?? row.sort_order,
    role ?? row.role ?? 'kid',
    nextBirthday,
    nextLaundryDay,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM kids WHERE id = ?').get(req.params.id));
});

// -- CHORES --
router.post('/chores', requirePin, (req, res) => {
  const { kid_id, title, points, frequency, days_of_week, active, sort_order, interval_days, notes } = req.body || {};
  if (!kid_id || !title) return res.status(400).json({ error: 'kid_id and title required' });
  const id = nanoid();
  db.prepare(
    `INSERT INTO chores (id, kid_id, title, points, frequency, days_of_week, active, sort_order, interval_days, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    kid_id,
    title,
    points ?? 1,
    frequency || 'daily',
    days_of_week || '0,1,2,3,4,5,6',
    active != null ? (active ? 1 : 0) : 1,
    sort_order ?? 0,
    interval_days != null ? Number(interval_days) : null,
    notes || null
  );
  res.json(db.prepare('SELECT * FROM chores WHERE id = ?').get(id));
});

router.put('/chores/:id', requirePin, (req, res) => {
  const row = db.prepare('SELECT * FROM chores WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const { kid_id, title, points, frequency, days_of_week, active, sort_order, interval_days, notes } = req.body || {};
  const nextInterval =
    interval_days === undefined ? row.interval_days :
    (interval_days === '' || interval_days === null) ? null :
    Number(interval_days);
  const nextNotes =
    notes === undefined ? row.notes :
    (notes === '' || notes === null) ? null :
    notes;
  db.prepare(
    `UPDATE chores SET kid_id = ?, title = ?, points = ?, frequency = ?, days_of_week = ?, active = ?, sort_order = ?, interval_days = ?, notes = ?
     WHERE id = ?`
  ).run(
    kid_id ?? row.kid_id,
    title ?? row.title,
    points ?? row.points,
    frequency ?? row.frequency,
    days_of_week ?? row.days_of_week,
    active != null ? (active ? 1 : 0) : row.active,
    sort_order ?? row.sort_order,
    nextInterval,
    nextNotes,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM chores WHERE id = ?').get(req.params.id));
});

router.delete('/chores/:id', requirePin, (req, res) => {
  db.prepare('DELETE FROM chores WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.get('/chores', requirePin, (_req, res) => {
  const rows = db.prepare(`
    SELECT c.*, k.name AS kid_name, k.color AS kid_color
    FROM chores c JOIN kids k ON k.id = c.kid_id
    ORDER BY k.sort_order, c.sort_order
  `).all();
  res.json(rows);
});

export default router;
