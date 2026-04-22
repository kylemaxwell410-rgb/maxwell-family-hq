import { Router } from 'express';
import { db, nanoid } from '../db.js';

const router = Router();

function todayStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// GET /api/chores?date=YYYY-MM-DD   -> chores with today's completion status
router.get('/', (req, res) => {
  const date = req.query.date || todayStr();
  const dow = new Date(date + 'T00:00:00').getDay(); // 0=Sun

  const chores = db.prepare(`
    SELECT c.*, k.name AS kid_name, k.color AS kid_color, k.initials AS kid_initials
    FROM chores c JOIN kids k ON k.id = c.kid_id
    WHERE c.active = 1
    ORDER BY k.sort_order, c.sort_order
  `).all();

  const completions = db.prepare(
    'SELECT chore_id, completed_at FROM chore_completions WHERE completed_date = ?'
  ).all(date);
  const compMap = new Map(completions.map(c => [c.chore_id, c.completed_at]));

  const withStatus = chores
    .filter(c => {
      const days = c.days_of_week.split(',').map(Number);
      return days.includes(dow);
    })
    .map(c => ({
      ...c,
      completed: compMap.has(c.id),
      completed_at: compMap.get(c.id) || null,
    }));

  res.json(withStatus);
});

// POST /api/chores/:id/complete { date? }
router.post('/:id/complete', (req, res) => {
  const date = req.body?.date || todayStr();
  const chore = db.prepare('SELECT * FROM chores WHERE id = ?').get(req.params.id);
  if (!chore) return res.status(404).json({ error: 'Chore not found' });

  const existing = db.prepare(
    'SELECT id FROM chore_completions WHERE chore_id = ? AND completed_date = ?'
  ).get(chore.id, date);
  if (existing) return res.json({ ok: true, alreadyCompleted: true });

  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare(
      'INSERT INTO chore_completions (id, chore_id, completed_date, completed_at) VALUES (?, ?, ?, ?)'
    ).run(nanoid(), chore.id, date, now);

    db.prepare('UPDATE kids SET points_balance = points_balance + ? WHERE id = ?')
      .run(chore.points, chore.kid_id);

    db.prepare(
      'INSERT INTO point_transactions (id, kid_id, amount, reason, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(nanoid(), chore.kid_id, chore.points, `Completed: ${chore.title}`, now);
  });
  tx();

  res.json({ ok: true, awarded: chore.points });
});

// POST /api/chores/:id/uncomplete { date? }
router.post('/:id/uncomplete', (req, res) => {
  const date = req.body?.date || todayStr();
  const chore = db.prepare('SELECT * FROM chores WHERE id = ?').get(req.params.id);
  if (!chore) return res.status(404).json({ error: 'Chore not found' });

  const existing = db.prepare(
    'SELECT id FROM chore_completions WHERE chore_id = ? AND completed_date = ?'
  ).get(chore.id, date);
  if (!existing) return res.json({ ok: true, wasNotCompleted: true });

  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM chore_completions WHERE id = ?').run(existing.id);
    db.prepare('UPDATE kids SET points_balance = points_balance - ? WHERE id = ?')
      .run(chore.points, chore.kid_id);
    db.prepare(
      'INSERT INTO point_transactions (id, kid_id, amount, reason, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(nanoid(), chore.kid_id, -chore.points, `Undo: ${chore.title}`, now);
  });
  tx();

  res.json({ ok: true, reversed: chore.points });
});

export default router;
