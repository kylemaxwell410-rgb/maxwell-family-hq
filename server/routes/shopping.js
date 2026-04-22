import { Router } from 'express';
import { db, nanoid } from '../db.js';

const router = Router();

router.get('/', (_req, res) => {
  const rows = db.prepare(
    'SELECT * FROM shopping_items ORDER BY checked, created_at DESC'
  ).all();
  res.json(rows);
});

router.post('/', (req, res) => {
  const { item, category } = req.body || {};
  if (!item) return res.status(400).json({ error: 'item required' });
  const id = nanoid();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO shopping_items (id, item, category, checked, created_at) VALUES (?, ?, ?, 0, ?)'
  ).run(id, item, category || null, now);
  res.json(db.prepare('SELECT * FROM shopping_items WHERE id = ?').get(id));
});

router.patch('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM shopping_items WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const { item, category, checked } = req.body || {};
  db.prepare(
    'UPDATE shopping_items SET item = ?, category = ?, checked = ? WHERE id = ?'
  ).run(
    item ?? row.item,
    category ?? row.category,
    checked != null ? (checked ? 1 : 0) : row.checked,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM shopping_items WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM shopping_items WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.post('/clear-checked', (_req, res) => {
  const r = db.prepare('DELETE FROM shopping_items WHERE checked = 1').run();
  res.json({ ok: true, deleted: r.changes });
});

export default router;
