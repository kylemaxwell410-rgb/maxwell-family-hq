import { useEffect, useState } from 'react';

// Callahan, FL. Adjust here if you move.
const LAT = 30.5621;
const LON = -81.8298;
const TZ  = 'America/New_York';

const URL =
  `https://api.open-meteo.com/v1/forecast` +
  `?latitude=${LAT}&longitude=${LON}` +
  `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
  `&temperature_unit=fahrenheit&timezone=${encodeURIComponent(TZ)}&forecast_days=3`;

// WMO weather code → emoji + label.
function describe(code) {
  if (code === 0)                           return { icon: '☀️', label: 'Sunny' };
  if (code === 1 || code === 2)             return { icon: '🌤️', label: 'Partly cloudy' };
  if (code === 3)                           return { icon: '☁️', label: 'Cloudy' };
  if (code === 45 || code === 48)           return { icon: '🌫️', label: 'Fog' };
  if (code >= 51 && code <= 57)             return { icon: '🌦️', label: 'Drizzle' };
  if (code >= 61 && code <= 67)             return { icon: '🌧️', label: 'Rain' };
  if (code >= 71 && code <= 77)             return { icon: '❄️', label: 'Snow' };
  if (code >= 80 && code <= 82)             return { icon: '🌧️', label: 'Showers' };
  if (code >= 95 && code <= 99)             return { icon: '⛈️', label: 'Storms' };
  return { icon: '·', label: '—' };
}

const DAY_LABELS = ['Today', 'Tomorrow'];
function dayLabel(dateStr, idx) {
  if (idx < 2) return DAY_LABELS[idx];
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short' });
}

export default function Weather() {
  const [days, setDays] = useState(null);
  const [err, setErr]   = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(URL);
        if (!res.ok) throw new Error('weather fetch failed');
        const json = await res.json();
        if (cancelled) return;
        const out = json.daily.time.map((t, i) => ({
          date: t,
          high: Math.round(json.daily.temperature_2m_max[i]),
          low:  Math.round(json.daily.temperature_2m_min[i]),
          ...describe(json.daily.weather_code[i]),
        }));
        setDays(out);
        setErr(null);
      } catch (e) {
        if (!cancelled) setErr(e.message);
      }
    }
    load();
    const id = setInterval(load, 30 * 60 * 1000); // refresh every 30 min
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (err)   return <div className="text-xs text-slate-400">Weather unavailable</div>;
  if (!days) return <div className="text-xs text-slate-400">Loading weather…</div>;

  return (
    <div className="flex items-stretch gap-2">
      {days.map((d, i) => (
        <div key={d.date}
          className="flex flex-col items-center justify-center px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 min-w-[88px]">
          <div className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 leading-none">
            {dayLabel(d.date, i)}
          </div>
          <div className="text-2xl leading-none my-0.5" title={d.label}>{d.icon}</div>
          <div className="text-sm font-bold tabular-nums text-slate-800 leading-none">
            {d.high}° <span className="text-slate-400 font-medium">/ {d.low}°</span>
          </div>
        </div>
      ))}
    </div>
  );
}
