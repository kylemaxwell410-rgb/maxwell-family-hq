import { Router } from 'express';
import { db, nanoid } from '../db.js';

const router = Router();

// GET /api/events?from=ISO&to=ISO
router.get('/', (req, res) => {
  const { from, to } = req.query;
  let rows;
  if (from && to) {
    rows = db.prepare(
      'SELECT * FROM events WHERE start_datetime >= ? AND start_datetime <= ? ORDER BY start_datetime'
    ).all(from, to);
  } else {
    rows = db.prepare('SELECT * FROM events ORDER BY start_datetime').all();
  }
  res.json(rows);
});

router.post('/', (req, res) => {
  const { title, start_datetime, end_datetime, kid_id, notes, all_day } = req.body || {};
  if (!title || !start_datetime) {
    return res.status(400).json({ error: 'title and start_datetime required' });
  }
  const id = nanoid();
  db.prepare(
    `INSERT INTO events (id, title, start_datetime, end_datetime, kid_id, notes, all_day)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, title, start_datetime, end_datetime || null, kid_id || null, notes || null, all_day ? 1 : 0);
  res.json(db.prepare('SELECT * FROM events WHERE id = ?').get(id));
});

router.put('/:id', (req, res) => {
  const { title, start_datetime, end_datetime, kid_id, notes, all_day } = req.body || {};
  const row = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  db.prepare(
    `UPDATE events SET title = ?, start_datetime = ?, end_datetime = ?, kid_id = ?, notes = ?, all_day = ?
     WHERE id = ?`
  ).run(
    title ?? row.title,
    start_datetime ?? row.start_datetime,
    end_datetime ?? row.end_datetime,
    kid_id ?? row.kid_id,
    notes ?? row.notes,
    all_day != null ? (all_day ? 1 : 0) : row.all_day,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
