import { Router } from 'express';
import { db, nanoid } from '../db.js';
import { requirePin } from '../middleware/require-pin.js';

const router = Router();

// Bot rate limiting — protects the billed Anthropic key from a kid spamming
// the Ask button. Limits are global to the device (single-kiosk install).
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT_PER_MIN = 10;
const DAILY_LIMIT = 200;
const rate = { times: [], dayKey: '', dayCount: 0 };
function checkBotRate() {
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  if (rate.dayKey !== today) { rate.dayKey = today; rate.dayCount = 0; }
  rate.times = rate.times.filter(t => now - t < RATE_WINDOW_MS);
  if (rate.dayCount >= DAILY_LIMIT) return { ok: false, error: `Daily limit reached (${DAILY_LIMIT}). Resets at midnight.` };
  if (rate.times.length >= RATE_LIMIT_PER_MIN) return { ok: false, error: 'Too many questions in the last minute. Try again in a moment.' };
  rate.times.push(now);
  rate.dayCount += 1;
  return { ok: true };
}

const SYSTEM_PROMPT = `Your name is Max. You are the friendly assistant on the Maxwell Family Planner
wall display. The Maxwell family lives on a small farm in Callahan, Florida.
There are four kids (Kolt, Michael-ann, Emma, Preston), Mom, Dad, and pets
(Jack & Shadow, both dogs). Kids ages 4-12 will ask you questions on a
touchscreen.

Rules:
- Introduce yourself as Max if it comes up. Be warm, kind, and age-appropriate.
- Keep answers short — 1-3 short paragraphs at most.
- No scary, violent, sexual, or political content. No medical, legal, or financial advice.
- If asked about something inappropriate, gently redirect to a kid-friendly topic.
- If asked something that needs grown-up help, suggest asking Mom or Dad.
- Be encouraging about chores, school, kindness, and outdoor play.`;

router.post('/ask', async (req, res) => {
  const { question, kid_name } = req.body || {};
  if (!question || !question.trim()) return res.status(400).json({ error: 'question required' });

  const gate = checkBotRate();
  if (!gate.ok) return res.status(429).json({ error: gate.error });

  const apiKey = db.prepare("SELECT value FROM settings WHERE key = 'anthropic_api_key'").get()?.value;
  if (!apiKey) {
    return res.status(503).json({ error: 'No Anthropic API key configured. Add one in Admin → Settings to enable the bot.' });
  }

  const id = nanoid();
  const created_at = new Date().toISOString();
  const insert = db.prepare('INSERT INTO bot_messages (id, kid_name, question, answer, error, created_at) VALUES (?, ?, ?, ?, ?, ?)');

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: question.trim() }],
      }),
    });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      const err = `Anthropic API ${r.status}: ${text.slice(0, 200)}`;
      insert.run(id, kid_name || null, question.trim(), null, err, created_at);
      return res.status(502).json({ error: err });
    }
    const data = await r.json();
    const answer = data.content?.[0]?.text || '';
    insert.run(id, kid_name || null, question.trim(), answer, null, created_at);
    res.json({ id, answer });
  } catch (e) {
    insert.run(id, kid_name || null, question.trim(), null, e.message, created_at);
    res.status(500).json({ error: e.message });
  }
});

// Audit log — PIN-gated.
router.get('/log', requirePin, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  const rows = db.prepare('SELECT id, kid_name, question, answer, error, created_at FROM bot_messages ORDER BY created_at DESC LIMIT ?').all(limit);
  res.json(rows);
});

router.delete('/log', requirePin, (_req, res) => {
  db.prepare('DELETE FROM bot_messages').run();
  res.json({ ok: true });
});

export default router;
