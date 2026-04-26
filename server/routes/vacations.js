import { Router } from 'express';
import { db, nanoid } from '../db.js';

const router = Router();
const PIN = process.env.ADMIN_PIN || '1234';
function requirePin(req, res, next) {
  const sent = req.headers['x-admin-pin'] || req.body?.pin;
  if (sent !== PIN) return res.status(401).json({ error: 'Invalid PIN' });
  next();
}

// Public read — list everything in start-date order (the client filters
// to "still upcoming or in-progress" itself).
router.get('/', (_req, res) => {
  const rows = db.prepare(
    'SELECT id, title, location, start_date, end_date, notes, created_at FROM vacations ORDER BY start_date ASC'
  ).all();
  res.json(rows);
});

router.post('/', requirePin, (req, res) => {
  const { title, location, start_date, end_date, notes } = req.body || {};
  if (!title || !start_date || !end_date) {
    return res.status(400).json({ error: 'title, start_date, end_date required' });
  }
  const id = nanoid();
  db.prepare(
    'INSERT INTO vacations (id, title, location, start_date, end_date, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, title.trim(), location?.trim() || null, start_date, end_date, notes?.trim() || null, new Date().toISOString());
  res.json(db.prepare('SELECT * FROM vacations WHERE id = ?').get(id));
});

router.put('/:id', requirePin, (req, res) => {
  const row = db.prepare('SELECT * FROM vacations WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const { title, location, start_date, end_date, notes } = req.body || {};
  db.prepare(
    'UPDATE vacations SET title = ?, location = ?, start_date = ?, end_date = ?, notes = ? WHERE id = ?'
  ).run(
    title?.trim() ?? row.title,
    location === undefined ? row.location : (location?.trim() || null),
    start_date ?? row.start_date,
    end_date ?? row.end_date,
    notes === undefined ? row.notes : (notes?.trim() || null),
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM vacations WHERE id = ?').get(req.params.id));
});

router.delete('/:id', requirePin, (req, res) => {
  db.prepare('DELETE FROM vacations WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
