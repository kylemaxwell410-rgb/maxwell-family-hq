import { Router } from 'express';
import { db, nanoid } from '../db.js';

const router = Router();

export const REWARDS = [
  { id: 'screen30',  label: '30 min screen time', cost: 15 },
  { id: 'icecream',  label: 'Ice cream',           cost: 25 },
  { id: 'moviepick', label: 'Movie pick',          cost: 30 },
  { id: 'sleepover', label: 'Sleepover',           cost: 75 },
  { id: 'cash5',     label: '$5 cash',             cost: 50 },
  { id: 'cash10',    label: '$10 cash',            cost: 100 },
];

router.get('/rewards', (_req, res) => res.json(REWARDS));

// GET /api/points/transactions?kid_id=&limit=50
router.get('/transactions', (req, res) => {
  const { kid_id } = req.query;
  const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
  const rows = kid_id
    ? db.prepare(
        'SELECT * FROM point_transactions WHERE kid_id = ? ORDER BY created_at DESC LIMIT ?'
      ).all(kid_id, limit)
    : db.prepare(
        'SELECT * FROM point_transactions ORDER BY created_at DESC LIMIT ?'
      ).all(limit);
  res.json(rows);
});

// POST /api/points/redeem  { kid_id, reward_id }
router.post('/redeem', (req, res) => {
  const { kid_id, reward_id } = req.body || {};
  if (!kid_id || !reward_id) return res.status(400).json({ error: 'kid_id and reward_id required' });
  const kid = db.prepare('SELECT * FROM kids WHERE id = ?').get(kid_id);
  if (!kid) return res.status(404).json({ error: 'Kid not found' });
  const reward = REWARDS.find(r => r.id === reward_id);
  if (!reward) return res.status(404).json({ error: 'Reward not found' });
  if (kid.points_balance < reward.cost) {
    return res.status(400).json({ error: 'Not enough points' });
  }
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare('UPDATE kids SET points_balance = points_balance - ? WHERE id = ?')
      .run(reward.cost, kid_id);
    db.prepare(
      'INSERT INTO point_transactions (id, kid_id, amount, reason, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(nanoid(), kid_id, -reward.cost, `Redeemed: ${reward.label}`, now);
  });
  tx();
  res.json({ ok: true, spent: reward.cost });
});

// POST /api/points/adjust  { kid_id, amount, reason }  (admin)
router.post('/adjust', (req, res) => {
  const { kid_id, amount, reason } = req.body || {};
  if (!kid_id || typeof amount !== 'number') {
    return res.status(400).json({ error: 'kid_id and amount required' });
  }
  const kid = db.prepare('SELECT * FROM kids WHERE id = ?').get(kid_id);
  if (!kid) return res.status(404).json({ error: 'Kid not found' });
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare('UPDATE kids SET points_balance = points_balance + ? WHERE id = ?')
      .run(amount, kid_id);
    db.prepare(
      'INSERT INTO point_transactions (id, kid_id, amount, reason, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(nanoid(), kid_id, amount, reason || 'Manual adjustment', now);
  });
  tx();
  res.json({ ok: true });
});

export default router;
