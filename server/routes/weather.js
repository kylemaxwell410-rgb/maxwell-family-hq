import { Router } from 'express';

const router = Router();

// Primary: National Weather Service (api.weather.gov). Free, no key, very
// reliable for US locations. NWS data is what NOAA's own forecasts come from.
//
// Fallback: Open-Meteo. Only used if NWS errors twice in a row — keeps the
// kiosk from going blank during a transient NWS outage.
//
// Response shape matches Open-Meteo's so the client code stays identical:
//   { current: { temperature_2m, weather_code, is_day, wind_speed_10m },
//     daily:   { time[], weather_code[], temperature_2m_max[], temperature_2m_min[],
//                precipitation_probability_max[], precipitation_sum[],
//                sunrise[], sunset[] } }

// NWS asks API users to include a contact in the User-Agent. Generic but identifies us.
const NWS_UA = 'MaxwellFamilyHQ/1.0 (kylemaxwell410@gmail.com)';

const FORECAST_TTL_MS = 10 * 60_000;
const POINTS_TTL_MS   = 24 * 3600_000; // gridpoint URLs are stable per lat/lon

const forecastCache = { at: 0, key: '', body: null };
const pointsCache   = new Map(); // key=`${lat}|${lon}` → { at, data }

async function getPoints(lat, lon) {
  const key = `${lat}|${lon}`;
  const cached = pointsCache.get(key);
  if (cached && Date.now() - cached.at < POINTS_TTL_MS) return cached.data;

  const url = `https://api.weather.gov/points/${lat},${lon}`;
  const r = await fetch(url, {
    headers: { 'User-Agent': NWS_UA, Accept: 'application/geo+json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`NWS points ${r.status}`);
  const data = await r.json();
  // Build the raw-gridpoint URL — we need it for precipitation amounts since
  // the standard /forecast endpoint only gives probability, not mm/inches.
  const gp = data.properties.gridId && data.properties.gridX != null && data.properties.gridY != null
    ? `https://api.weather.gov/gridpoints/${data.properties.gridId}/${data.properties.gridX},${data.properties.gridY}`
    : null;
  const out = {
    forecast: data.properties.forecast,
    gridpoint: gp,
    observationStations: data.properties.observationStations,
    timeZone: data.properties.timeZone,
  };
  pointsCache.set(key, { at: Date.now(), data: out });
  return out;
}

// NWS quantitativePrecipitation values are in mm over a period. Sum per local
// date so each ForecastDay tile can show inches of expected rainfall.
async function fetchPrecipByDate(gridpointUrl) {
  if (!gridpointUrl) return {};
  const r = await fetch(gridpointUrl, {
    headers: { 'User-Agent': NWS_UA, Accept: 'application/geo+json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`NWS gridpoint ${r.status}`);
  const data = await r.json();
  const values = data.properties?.quantitativePrecipitation?.values || [];
  const byDate = {}; // YYYY-MM-DD → mm
  for (const v of values) {
    if (v.value == null) continue;
    // validTime looks like "2026-05-12T20:00:00+00:00/PT6H" — date prefix is enough.
    const startIso = v.validTime.split('/')[0];
    const dateKey = new Date(startIso).toLocaleDateString('en-CA'); // YYYY-MM-DD in local TZ
    byDate[dateKey] = (byDate[dateKey] || 0) + v.value;
  }
  // mm → inches
  const inchesByDate = {};
  for (const [d, mm] of Object.entries(byDate)) inchesByDate[d] = mm / 25.4;
  return inchesByDate;
}

async function nearestStationId(stationsUrl) {
  const r = await fetch(stationsUrl, {
    headers: { 'User-Agent': NWS_UA, Accept: 'application/geo+json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`NWS stations ${r.status}`);
  const data = await r.json();
  return data.features?.[0]?.properties?.stationIdentifier;
}

async function latestObservation(stationId) {
  const url = `https://api.weather.gov/stations/${stationId}/observations/latest`;
  const r = await fetch(url, {
    headers: { 'User-Agent': NWS_UA, Accept: 'application/geo+json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`NWS obs ${r.status}`);
  const data = await r.json();
  return data.properties;
}

async function fetchForecastPeriods(forecastUrl) {
  const r = await fetch(forecastUrl, {
    headers: { 'User-Agent': NWS_UA, Accept: 'application/geo+json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`NWS forecast ${r.status}`);
  const data = await r.json();
  return data.properties.periods;
}

// NWS shortForecast strings → WMO weather codes (matches client CODE_MAP keys).
function shortToWmoCode(short) {
  if (!short) return 3;
  const s = String(short).toLowerCase();
  if (s.includes('thunder') && s.includes('hail')) return 96;
  if (s.includes('severe')  && s.includes('storm')) return 99;
  if (s.includes('thunder')) return 95;
  if (s.includes('snow')) {
    if (s.includes('heavy')) return 75;
    if (s.includes('light') || s.includes('chance')) return 71;
    return 73;
  }
  if (s.includes('shower')) {
    if (s.includes('heavy')) return 82;
    return 80;
  }
  if (s.includes('rain')) {
    if (s.includes('heavy')) return 65;
    if (s.includes('light') || s.includes('slight')) return 61;
    return 63;
  }
  if (s.includes('drizzle')) return 51;
  if (s.includes('fog') || s.includes('haze')) return 45;
  if (s.includes('mostly cloudy') || s.includes('overcast')) return 3;
  if (s.includes('cloudy')) return 3;
  if (s.includes('partly'))       return 2;
  if (s.includes('mostly sunny') || s.includes('mostly clear')) return 1;
  if (s.includes('sunny') || s.includes('clear')) return 0;
  return 3;
}

// NWS returns observation values with unit codes. Convert what we need.
function obsTempF(obs) {
  const t = obs?.temperature;
  if (t?.value == null) return null;
  if (t.unitCode?.includes('degC')) return t.value * 9 / 5 + 32;
  return t.value;
}
function obsWindMph(obs) {
  const w = obs?.windSpeed;
  if (w?.value == null) return null;
  if (w.unitCode?.includes('km_h-1') || w.unitCode?.includes('km/h')) return w.value * 0.621371;
  if (w.unitCode?.includes('m_s-1')) return w.value * 2.23694;
  return w.value;
}

// NWS only returns *future* periods. Once today's daytime period has ended
// (after sunset, roughly), today's group has only a night entry, and our
// `temperature_2m_max` lookup falls through to the overnight low — so the
// kiosk shows today's "high" as ~65°F. Detect that case so a caller can
// supplement today's high from Open-Meteo.
export function todayNeedsHighSupplement(grouped) {
  const today = grouped[0];
  return !!(today && !today.day && today.night);
}

// Group day+night NWS periods into one daily entry per local date.
function groupPeriodsByDate(periods) {
  const byDate = new Map();
  for (const p of periods) {
    const date = p.startTime.slice(0, 10); // ISO YYYY-MM-DD in NWS local TZ
    if (!byDate.has(date)) byDate.set(date, { date, day: null, night: null });
    const slot = byDate.get(date);
    if (p.isDaytime) slot.day = p;
    else slot.night = p;
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

async function fetchNws(lat, lon) {
  const points = await getPoints(lat, lon);
  const [periods, stationId, precipByDate] = await Promise.all([
    fetchForecastPeriods(points.forecast),
    nearestStationId(points.observationStations).catch(() => null),
    fetchPrecipByDate(points.gridpoint).catch(() => ({})),
  ]);
  let obs = null;
  if (stationId) {
    obs = await latestObservation(stationId).catch(() => null);
  }

  const grouped = groupPeriodsByDate(periods).slice(0, 7);
  const daily = {
    time:                          grouped.map(g => g.date),
    weather_code:                  grouped.map(g => shortToWmoCode((g.day || g.night)?.shortForecast)),
    temperature_2m_max:            grouped.map(g => g.day?.temperature   ?? g.night?.temperature ?? null),
    temperature_2m_min:            grouped.map(g => g.night?.temperature ?? g.day?.temperature   ?? null),
    precipitation_probability_max: grouped.map(g => Math.max(
      g.day?.probabilityOfPrecipitation?.value   ?? 0,
      g.night?.probabilityOfPrecipitation?.value ?? 0,
    )),
    precipitation_sum: grouped.map(g => precipByDate[g.date] ?? null),
    sunrise:           grouped.map(() => null),
    sunset:            grouped.map(() => null),
  };

  // Decide is_day from the most recent period: if its isDaytime is true and
  // startTime <= now <= endTime, use that.
  const nowMs = Date.now();
  const activePeriod = periods.find(p => {
    const a = new Date(p.startTime).getTime();
    const b = new Date(p.endTime).getTime();
    return nowMs >= a && nowMs <= b;
  }) || periods[0];

  const obsTemp = obsTempF(obs);
  const obsWind = obsWindMph(obs);
  const current = {
    temperature_2m: obsTemp != null ? obsTemp : (activePeriod?.temperature ?? null),
    weather_code:   shortToWmoCode(obs?.textDescription || activePeriod?.shortForecast),
    is_day:         !!activePeriod?.isDaytime,
    wind_speed_10m: obsWind != null ? obsWind : 0,
  };

  // After-sunset patch: if NWS dropped today's day period, today's high is the
  // overnight low. Pull today's max from Open-Meteo so the kiosk stays sane.
  if (todayNeedsHighSupplement(grouped)) {
    try {
      const om = await fetchOpenMeteoFallback(lat, lon, points.timeZone || 'America/New_York');
      const omIdx = om.daily?.time?.indexOf(grouped[0].date);
      if (omIdx != null && omIdx >= 0 && om.daily.temperature_2m_max?.[omIdx] != null) {
        daily.temperature_2m_max[0] = om.daily.temperature_2m_max[omIdx];
      }
    } catch (e) {
      console.error('[weather] today-high supplement failed:', e.message);
    }
  }

  return { current, daily, source: 'nws' };
}

async function fetchOpenMeteoFallback(lat, lon, tz) {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', lat);
  url.searchParams.set('longitude', lon);
  url.searchParams.set('current', 'temperature_2m,weather_code,is_day,wind_speed_10m');
  url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,sunrise,sunset');
  url.searchParams.set('temperature_unit', 'fahrenheit');
  url.searchParams.set('wind_speed_unit', 'mph');
  url.searchParams.set('precipitation_unit', 'inch');
  url.searchParams.set('timezone', tz);
  url.searchParams.set('forecast_days', '7');
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`Open-Meteo ${r.status}`);
  const body = await r.json();
  body.source = 'open-meteo-fallback';
  return body;
}

router.get('/', async (req, res) => {
  const lat  = req.query.latitude  || '30.5582';
  const lon  = req.query.longitude || '-81.8307';
  const tz   = req.query.timezone  || 'America/New_York';
  const key  = `${lat}|${lon}|${tz}`;

  if (forecastCache.body && forecastCache.key === key && Date.now() - forecastCache.at < FORECAST_TTL_MS) {
    return res.json(forecastCache.body);
  }

  try {
    const body = await fetchNws(lat, lon);
    forecastCache.at = Date.now();
    forecastCache.key = key;
    forecastCache.body = body;
    res.json(body);
  } catch (nwsErr) {
    console.error('[weather] NWS failed, falling back to Open-Meteo:', nwsErr.message);
    try {
      const body = await fetchOpenMeteoFallback(lat, lon, tz);
      forecastCache.at = Date.now();
      forecastCache.key = key;
      forecastCache.body = body;
      res.json(body);
    } catch (omErr) {
      console.error('[weather] Open-Meteo also failed:', omErr.message);
      if (forecastCache.body) return res.json(forecastCache.body); // stale > nothing
      res.status(502).json({ error: 'Weather temporarily unavailable' });
    }
  }
});

export default router;
