import { Router } from 'express';
import ical from 'node-ical';
import { db } from '../db.js';

const router = Router();

// Cache parsed ICS for 5 minutes — Google updates secret ICS feeds roughly
// every few hours anyway, so polling more aggressively just burns bandwidth.
const CACHE_TTL_MS = 5 * 60_000;
let cache = { at: 0, url: '', events: [] };

function readGcalUrl() {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'gcal_ics_url'").get();
  return row?.value || '';
}

async function fetchAndParse(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`Calendar feed ${r.status}`);
  const text = await r.text();
  return ical.parseICS(text);
}

// Expand RRULE-based recurring events into concrete instances within [from, to].
// For non-recurring events, just return them if they overlap the window.
function instancesInRange(parsed, from, to) {
  const out = [];
  for (const k of Object.keys(parsed)) {
    const ev = parsed[k];
    if (ev.type !== 'VEVENT') continue;

    if (ev.rrule) {
      const dates = ev.rrule.between(from, to, true);
      for (const d of dates) {
        // node-ical handles EXDATE internally via rrule; double-check anyway.
        const key = d.toISOString();
        if (ev.exdate && ev.exdate[key]) continue;
        const durationMs = ev.end - ev.start;
        out.push(makeEvent(ev, d, new Date(d.getTime() + durationMs)));
      }
    } else {
      // Single (non-recurring) event — include if it overlaps the window.
      if (ev.end >= from && ev.start <= to) {
        out.push(makeEvent(ev, ev.start, ev.end));
      }
    }
  }
  // Sort by start time so the client doesn't have to.
  out.sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime));
  return out;
}

function makeEvent(ev, start, end) {
  // All-day events in ICS have DTSTART with a DATE value (no time component).
  // node-ical exposes this as ev.datetype === 'date'.
  const allDay = ev.datetype === 'date';
  return {
    id: `ext_${ev.uid}_${start.toISOString()}`,
    title: ev.summary || '(untitled)',
    start_datetime: start.toISOString(),
    end_datetime: end ? end.toISOString() : null,
    kid_id: null,
    notes: ev.description || null,
    all_day: allDay ? 1 : 0,
    external: true,
    location: ev.location || null,
  };
}

// GET /api/external-calendar?from=ISO&to=ISO  → expanded events in window.
router.get('/', async (req, res) => {
  const url = readGcalUrl();
  if (!url) return res.json({ events: [], configured: false });

  const from = req.query.from ? new Date(req.query.from) : new Date();
  const to   = req.query.to   ? new Date(req.query.to)   : new Date(from.getTime() + 30 * 86400_000);
  if (isNaN(from) || isNaN(to)) return res.status(400).json({ error: 'invalid from/to' });

  // Cache key is URL alone; we re-filter to the requested window in-memory.
  if (cache.url === url && Date.now() - cache.at < CACHE_TTL_MS && cache.parsed) {
    return res.json({ events: instancesInRange(cache.parsed, from, to), configured: true });
  }

  try {
    const parsed = await fetchAndParse(url);
    cache = { at: Date.now(), url, parsed };
    res.json({ events: instancesInRange(parsed, from, to), configured: true });
  } catch (e) {
    console.error('[external-calendar]', e.message);
    // Fall back to cached events if we have any.
    if (cache.parsed && cache.url === url) {
      return res.json({ events: instancesInRange(cache.parsed, from, to), configured: true, stale: true });
    }
    res.status(502).json({ error: e.message });
  }
});

export default router;
