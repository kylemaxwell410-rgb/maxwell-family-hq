import express from 'express';
import cors from 'cors';
import { initSchema, seedIfEmpty, applySeedColorUpdates } from './db.js';
import kidsRouter from './routes/kids.js';
import choresRouter from './routes/chores.js';
import eventsRouter from './routes/events.js';
import mealsRouter from './routes/meals.js';
import shoppingRouter from './routes/shopping.js';
import pointsRouter from './routes/points.js';
import adminRouter from './routes/admin.js';

initSchema();
seedIfEmpty();
applySeedColorUpdates();

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.use('/api/kids', kidsRouter);
app.use('/api/chores', choresRouter);
app.use('/api/events', eventsRouter);
app.use('/api/meals', mealsRouter);
app.use('/api/shopping', shoppingRouter);
app.use('/api/points', pointsRouter);
app.use('/api/admin', adminRouter);

app.use((err, _req, res, _next) => {
  console.error('[api]', err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[server] Maxwell HQ API listening on :${PORT}`);
});
