import { Router } from 'express';
import { db, nanoid } from '../db.js';

const router = Router();
const PIN = process.env.ADMIN_PIN || '1234';
function requirePin(req, res, next) {
  const sent = req.headers['x-admin-pin'] || req.body?.pin;
  if (sent !== PIN) return res.status(401).json({ error: 'Invalid PIN' });
  next();
}

// Public: list active notes (not expired). Anyone in the house can read.
router.get('/', (_req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const rows = db.prepare(`
    SELECT id, body, expires_on, created_at FROM family_notes
    WHERE expires_on IS NULL OR expires_on >= ?
    ORDER BY created_at DESC
  `).all(today);
  res.json(rows);
});

// Add / edit / delete are PIN-gated so kids can't blow them away.
router.post('/', requirePin, (req, res) => {
  const { body, expires_on } = req.body || {};
  if (!body || !body.trim()) return res.status(400).json({ error: 'body required' });
  const id = nanoid();
  db.prepare('INSERT INTO family_notes (id, body, expires_on, created_at) VALUES (?, ?, ?, ?)').run(
    id, body.trim(), expires_on || null, new Date().toISOString()
  );
  res.json(db.prepare('SELECT * FROM family_notes WHERE id = ?').get(id));
});

router.put('/:id', requirePin, (req, res) => {
  const row = db.prepare('SELECT * FROM family_notes WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const { body, expires_on } = req.body || {};
  db.prepare('UPDATE family_notes SET body = ?, expires_on = ? WHERE id = ?').run(
    body?.trim() ?? row.body,
    expires_on === undefined ? row.expires_on : (expires_on || null),
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM family_notes WHERE id = ?').get(req.params.id));
});

router.delete('/:id', requirePin, (req, res) => {
  db.prepare('DELETE FROM family_notes WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
