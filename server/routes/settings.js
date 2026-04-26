import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

const PIN = process.env.ADMIN_PIN || '1234';
function requirePin(req, res, next) {
  const sent = req.headers['x-admin-pin'] || req.body?.pin;
  if (sent !== PIN) return res.status(401).json({ error: 'Invalid PIN' });
  next();
}

// Keys whose value is sensitive — replace with a boolean flag so the client
// can show "saved" / "not saved" without leaking the secret.
const SECRET_KEYS = new Set(['anthropic_api_key']);

router.get('/', (_req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const out = {};
  for (const r of rows) {
    if (SECRET_KEYS.has(r.key)) out[r.key] = r.value ? true : false;
    else out[r.key] = r.value;
  }
  res.json(out);
});

router.put('/:key', requirePin, (req, res) => {
  const { value } = req.body || {};
  if (typeof value !== 'string') return res.status(400).json({ error: 'value (string) required' });
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(req.params.key, value);
  res.json({ key: req.params.key, value });
});

export default router;
