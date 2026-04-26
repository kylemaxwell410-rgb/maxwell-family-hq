import { Router } from 'express';
import { db, nanoid } from '../db.js';

const router = Router();

function todayStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysBetween(aStr, bStr) {
  const ms = new Date(bStr + 'T00:00:00') - new Date(aStr + 'T00:00:00');
  return Math.round(ms / 86400000);
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

  const lastCompletionStmt = db.prepare(
    'SELECT MAX(completed_date) AS d FROM chore_completions WHERE chore_id = ? AND completed_date <= ?'
  );
  const completionSinceStmt = db.prepare(
    'SELECT 1 FROM chore_completions WHERE chore_id = ? AND completed_date >= ? LIMIT 1'
  );

  // For weekly_rolling: walk back from today to find the most recent scheduled DOW.
  function lastScheduledOnOrBefore(daysCsv, refDate) {
    const days = daysCsv.split(',').map(Number);
    let d = new Date(refDate + 'T00:00:00');
    for (let back = 0; back < 7; back++) {
      if (days.includes(d.getDay())) return todayStr(d);
      d.setDate(d.getDate() - 1);
    }
    return refDate;
  }

  const withStatus = [];
  for (const c of chores) {
    const completed = compMap.has(c.id);
    let include = false;
    let overdue_days = 0;

    if (c.frequency === 'interval' && c.interval_days) {
      // Keep an interval chore visible on the day it's completed so the
      // parent sees the "All done" state instead of an empty column.
      if (completed) {
        include = true;
        overdue_days = 0;
      } else {
        const last = lastCompletionStmt.get(c.id, date)?.d;
        if (!last) {
          include = true;
          overdue_days = 0;
        } else {
          const due = (() => {
            const d = new Date(last + 'T00:00:00');
            d.setDate(d.getDate() + c.interval_days);
            return todayStr(d);
          })();
          if (date >= due) {
            include = true;
            overdue_days = Math.max(0, daysBetween(due, date));
          }
        }
      }
    } else if (c.frequency === 'weekly_rolling') {
      const days = c.days_of_week.split(',').map(Number);
      if (days.includes(dow)) {
        include = true;
        overdue_days = 0;
      } else {
        // Show every day after the scheduled DOW until completed.
        const lastSched = lastScheduledOnOrBefore(c.days_of_week, date);
        const completedSince = !!completionSinceStmt.get(c.id, lastSched);
        if (!completedSince) {
          include = true;
          overdue_days = daysBetween(lastSched, date);
        }
      }
    } else {
      // daily / weekly — existing day-of-week match.
      const days = c.days_of_week.split(',').map(Number);
      include = days.includes(dow);
    }

    if (!include) continue;
    withStatus.push({
      ...c,
      completed,
      completed_at: compMap.get(c.id) || null,
      overdue_days,
    });
  }

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
