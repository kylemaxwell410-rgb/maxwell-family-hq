import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// GET /api/streaks  → { kolt: 5, michaelann: 2, ... }
//
// "Streak" = consecutive days, walking back from today, where every chore that
// was scheduled for that kid on that day-of-week was completed. Days where the
// kid had no chores at all are skipped (don't break or extend). Today counts
// only if all of today's chores are done; an unfinished today doesn't break
// the streak — it just doesn't add to it yet.
router.get('/', (_req, res) => {
  const kids = db.prepare("SELECT id FROM kids WHERE role = 'kid'").all();
  const allChores = db.prepare('SELECT id, kid_id, days_of_week, active FROM chores WHERE active = 1').all();
  // Pull a 60-day window of completions in one shot for speed.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 60);
  const completions = db.prepare(
    'SELECT chore_id, completed_date FROM chore_completions WHERE completed_date >= ?'
  ).all(ymd(cutoff));
  const completionsByDate = new Map(); // date -> Set(chore_id)
  for (const c of completions) {
    let s = completionsByDate.get(c.completed_date);
    if (!s) { s = new Set(); completionsByDate.set(c.completed_date, s); }
    s.add(c.chore_id);
  }

  const out = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const k of kids) {
    const kidChores = allChores.filter(c => c.kid_id === k.id);
    let streak = 0;

    for (let offset = 0; offset < 60; offset++) {
      const day = new Date(today);
      day.setDate(day.getDate() - offset);
      const dow = day.getDay();
      const dStr = ymd(day);

      const scheduled = kidChores.filter(c =>
        c.days_of_week.split(',').map(Number).includes(dow)
      );
      if (scheduled.length === 0) {
        // No chores assigned this day — neutral, doesn't extend or break.
        continue;
      }
      const done = completionsByDate.get(dStr) || new Set();
      const allDone = scheduled.every(c => done.has(c.id));

      if (allDone) {
        streak += 1;
      } else if (offset === 0) {
        // Today not yet finished — don't break, but don't increment.
        continue;
      } else {
        break;
      }
    }
    out[k.id] = streak;
  }

  res.json(out);
});

export default router;
