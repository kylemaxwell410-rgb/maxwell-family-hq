import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

router.get('/', (_req, res) => {
  const rows = db.prepare('SELECT * FROM kids ORDER BY sort_order').all();
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM kids WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

export default router;
