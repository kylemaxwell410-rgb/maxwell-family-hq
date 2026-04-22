import { Router } from 'express';
import { db, nanoid } from '../db.js';

const router = Router();

// GET /api/meals?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/', (req, res) => {
  const { from, to } = req.query;
  let rows;
  if (from && to) {
    rows = db.prepare(
      'SELECT * FROM meals WHERE meal_date >= ? AND meal_date <= ? ORDER BY meal_date, meal_type'
    ).all(from, to);
  } else {
    rows = db.prepare('SELECT * FROM meals ORDER BY meal_date, meal_type').all();
  }
  res.json(rows);
});

// PUT /api/meals  { meal_date, meal_type, description }  (upsert)
router.put('/', (req, res) => {
  const { meal_date, meal_type, description } = req.body || {};
  if (!meal_date || !meal_type) {
    return res.status(400).json({ error: 'meal_date and meal_type required' });
  }
  const existing = db.prepare(
    'SELECT * FROM meals WHERE meal_date = ? AND meal_type = ?'
  ).get(meal_date, meal_type);

  if (existing) {
    db.prepare('UPDATE meals SET description = ? WHERE id = ?')
      .run(description || null, existing.id);
    return res.json(db.prepare('SELECT * FROM meals WHERE id = ?').get(existing.id));
  }
  const id = nanoid();
  db.prepare(
    'INSERT INTO meals (id, meal_date, meal_type, description) VALUES (?, ?, ?, ?)'
  ).run(id, meal_date, meal_type, description || null);
  res.json(db.prepare('SELECT * FROM meals WHERE id = ?').get(id));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM meals WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
