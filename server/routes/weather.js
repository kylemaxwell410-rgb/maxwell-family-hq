import { Router } from 'express';

const router = Router();

// Server-side proxy for Open-Meteo. The kiosk hits /api/weather (same origin),
// and we cache the upstream response for 10 min so we don't slam Open-Meteo.
const cache = { at: 0, key: '', body: null };
const TTL_MS = 10 * 60_000;

router.get('/', async (req, res) => {
  const lat  = req.query.latitude  || '30.5582';
  const lon  = req.query.longitude || '-81.8307';
  const tz   = req.query.timezone  || 'America/New_York';
  const days = req.query.forecast_days || '7';
  const key = `${lat}|${lon}|${tz}|${days}`;

  if (cache.body && cache.key === key && Date.now() - cache.at < TTL_MS) {
    return res.json(cache.body);
  }

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', lat);
  url.searchParams.set('longitude', lon);
  url.searchParams.set('current', 'temperature_2m,weather_code,is_day,wind_speed_10m');
  url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,sunrise,sunset');
  url.searchParams.set('temperature_unit', 'fahrenheit');
  url.searchParams.set('wind_speed_unit', 'mph');
  url.searchParams.set('precipitation_unit', 'inch');
  url.searchParams.set('timezone', tz);
  url.searchParams.set('forecast_days', days);

  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return res.status(502).json({ error: `Open-Meteo ${r.status}` });
    const body = await r.json();
    cache.at = Date.now();
    cache.key = key;
    cache.body = body;
    res.json(body);
  } catch (e) {
    // If we have any cached body, fall back to it on transient failures.
    if (cache.body) return res.json(cache.body);
    res.status(502).json({ error: e.message });
  }
});

export default router;
