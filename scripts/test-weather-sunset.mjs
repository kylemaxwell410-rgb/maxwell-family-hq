// Smoke test for the after-sunset NWS today-high bug.
// Pure-function check on todayNeedsHighSupplement + a stubbed-fetch end-to-end
// run of the weather route to confirm Open-Meteo is consulted for today's high.

import assert from 'node:assert/strict';
import { todayNeedsHighSupplement } from '../server/routes/weather.js';

// 1. Pure helper
assert.equal(
  todayNeedsHighSupplement([
    { date: '2026-05-16', day: null, night: { temperature: 65 } },
    { date: '2026-05-17', day: { temperature: 82 }, night: { temperature: 64 } },
  ]),
  true,
  'night-only today should trigger supplement',
);
assert.equal(
  todayNeedsHighSupplement([
    { date: '2026-05-16', day: { temperature: 88 }, night: { temperature: 65 } },
  ]),
  false,
  'day present today should NOT trigger supplement',
);
assert.equal(todayNeedsHighSupplement([]), false, 'empty groups → false');

// 2. End-to-end via stubbed fetch
const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local
const tomorrow = new Date(Date.now() + 86_400_000).toLocaleDateString('en-CA');

const realFetch = global.fetch;
global.fetch = async (url, _opts) => {
  const u = String(url);
  const json = (body) => ({
    ok: true,
    status: 200,
    json: async () => body,
  });
  if (u.includes('api.weather.gov/points/')) {
    return json({ properties: {
      forecast: 'https://api.weather.gov/MOCK/forecast',
      observationStations: 'https://api.weather.gov/MOCK/stations',
      gridId: 'MOCK', gridX: 1, gridY: 1,
      timeZone: 'America/New_York',
    } });
  }
  if (u.includes('api.weather.gov/MOCK/forecast')) {
    // Night-only for today, full for tomorrow — simulates "after sunset"
    return json({ properties: { periods: [
      { startTime: `${today}T20:00:00-04:00`, endTime: `${today}T06:00:00-04:00`,
        isDaytime: false, temperature: 64, shortForecast: 'Clear',
        probabilityOfPrecipitation: { value: 0 } },
      { startTime: `${tomorrow}T06:00:00-04:00`, endTime: `${tomorrow}T20:00:00-04:00`,
        isDaytime: true, temperature: 85, shortForecast: 'Sunny',
        probabilityOfPrecipitation: { value: 5 } },
      { startTime: `${tomorrow}T20:00:00-04:00`, endTime: `${tomorrow}T06:00:00-04:00`,
        isDaytime: false, temperature: 66, shortForecast: 'Clear',
        probabilityOfPrecipitation: { value: 0 } },
    ] } });
  }
  if (u.includes('api.weather.gov/MOCK/stations')) {
    return json({ features: [{ properties: { stationIdentifier: 'KMOCK' } }] });
  }
  if (u.includes('api.weather.gov/stations/KMOCK')) {
    return json({ properties: {
      temperature: { value: 22, unitCode: 'wmoUnit:degC' },
      windSpeed: { value: 5, unitCode: 'wmoUnit:km_h-1' },
      textDescription: 'Clear',
    } });
  }
  if (u.includes('api.weather.gov/gridpoints/')) {
    return json({ properties: { quantitativePrecipitation: { values: [] } } });
  }
  if (u.includes('open-meteo.com')) {
    return json({
      current: { temperature_2m: 72, weather_code: 0, is_day: 0, wind_speed_10m: 5 },
      daily: {
        time: [today, tomorrow],
        weather_code: [0, 0],
        temperature_2m_max: [89, 85],   // <-- the high we expect to be merged
        temperature_2m_min: [64, 66],
        precipitation_probability_max: [0, 5],
        precipitation_sum: [0, 0],
        sunrise: [null, null], sunset: [null, null],
      },
    });
  }
  return { ok: false, status: 404, json: async () => ({}) };
};

// Spin the route up with the stubbed fetch
const express = (await import('express')).default;
const weatherRouter = (await import('../server/routes/weather.js')).default;
const app = express();
app.use('/api/weather', weatherRouter);
const server = await new Promise((res) => {
  const s = app.listen(0, () => res(s));
});
const port = server.address().port;

const r = await realFetch(`http://localhost:${port}/api/weather?latitude=30.5582&longitude=-81.8307`);
const body = await r.json();
server.close();
global.fetch = realFetch;

assert.equal(body.source, 'nws', 'should report nws as source');
assert.equal(body.daily.time[0], today);
assert.equal(body.daily.temperature_2m_max[0], 89,
  `today's high should be patched from Open-Meteo (got ${body.daily.temperature_2m_max[0]})`);
assert.equal(body.daily.temperature_2m_min[0], 64);
assert.ok(body.daily.temperature_2m_max[0] >= body.daily.temperature_2m_min[0],
  'high must be >= low');

console.log('✓ weather sunset fix verified — today high =', body.daily.temperature_2m_max[0]);
