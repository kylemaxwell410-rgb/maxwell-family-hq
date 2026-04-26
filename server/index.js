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
import settingsRouter from './routes/settings.js';
import notesRouter from './routes/notes.js';
import botRouter from './routes/bot.js';
import streaksRouter from './routes/streaks.js';
import vacationsRouter from './routes/vacations.js';
import weatherRouter from './routes/weather.js';

initSchema();
seedIfEmpty();
applySeedColorUpdates();

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Bumped on every server start; the kiosk client polls and reloads on change so deploys auto-refresh.
const SERVER_START = new Date().toISOString();
app.get('/api/version', (_req, res) => res.json({ start: SERVER_START }));

app.use('/api/kids', kidsRouter);
app.use('/api/chores', choresRouter);
app.use('/api/events', eventsRouter);
app.use('/api/meals', mealsRouter);
app.use('/api/shopping', shoppingRouter);
app.use('/api/points', pointsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/notes', notesRouter);
app.use('/api/bot', botRouter);
app.use('/api/streaks', streaksRouter);
app.use('/api/vacations', vacationsRouter);
app.use('/api/weather', weatherRouter);

app.use((err, _req, res, _next) => {
  console.error('[api]', err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[server] Maxwell HQ API listening on :${PORT}`);
});
