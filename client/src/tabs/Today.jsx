import { useEffect, useMemo, useState } from 'react';
import { api, todayStr } from '../api.js';
import { startOfDay, endOfDay } from '../utils/dateMath.js';
import { fetchWeather, describeCode, getLocation } from '../utils/weather.js';
import { upcomingBirthdays } from '../utils/birthdays.js';
import { nextHoliday } from '../utils/holidays.js';

export default function Today({ kids }) {
  const [chores, setChores] = useState([]);
  const [events, setEvents] = useState([]);
  const [meal, setMeal]     = useState(null);
  const [weather, setWeather] = useState(null);
  const [weatherErr, setWeatherErr] = useState(null);

  async function loadEverything() {
    const today    = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());
    const dStr     = todayStr();
    const [c, e, m] = await Promise.all([
      api.chores(dStr),
      api.events(today.toISOString(), todayEnd.toISOString()),
      api.meals(dStr, dStr),
    ]);
    setChores(c);
    setEvents(e);
    setMeal((m || []).find(x => x.meal_type === 'dinner') || null);
  }

  useEffect(() => {
    loadEverything();
    const id = setInterval(loadEverything, 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const w = await fetchWeather();
        if (alive) { setWeather(w); setWeatherErr(null); }
      } catch (e) {
        if (alive) setWeatherErr(e.message);
      }
    }
    load();
    const id = setInterval(load, 15 * 60_000); // refresh every 15 min
    return () => clearInterval(id);
  }, []);

  const choresByKid = useMemo(() => {
    const map = {};
    for (const k of kids) map[k.id] = { done: 0, total: 0 };
    for (const c of chores) {
      const m = map[c.kid_id]; if (!m) continue;
      m.total += 1;
      if (c.completed) m.done += 1;
    }
    return map;
  }, [chores, kids]);

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime)),
    [events]
  );

  const birthdaysSoon = useMemo(() => upcomingBirthdays(kids), [kids]);
  const holiday = useMemo(() => nextHoliday(), []);

  return (
    <div className="h-full flex flex-col p-4 gap-3 overflow-hidden">
      {/* Top row: Weather, Events, Dinner */}
      <div className="grid grid-cols-3 gap-3 flex-1 min-h-0">
        <WeatherCard weather={weather} err={weatherErr} />
        <EventsCard events={sortedEvents} kids={kids} />
        <DinnerCard meal={meal} />
      </div>

      {/* Chores summary strip */}
      <ChoresStrip kids={kids} byKid={choresByKid} />

      {/* Countdowns */}
      <CountdownStrip birthdays={birthdaysSoon} holiday={holiday} />
    </div>
  );
}

/* ---------------- Weather ---------------- */

function WeatherCard({ weather, err }) {
  if (err) {
    return <Card title="Weather"><div className="text-rose-300 text-sm">{err}</div></Card>;
  }
  if (!weather) {
    return <Card title="Weather"><div className="text-slate-500 text-sm">Loading…</div></Card>;
  }
  const desc = describeCode(weather.today.code);
  const loc = getLocation();
  return (
    <div className="bg-[#111923] border border-white/5 rounded-2xl p-5 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Weather</div>
          <div className="text-sm text-slate-400">{loc.label}</div>
        </div>
        <div className="text-5xl">{desc.emoji}</div>
      </div>
      <div className="mt-2 flex items-baseline gap-3">
        <div className="text-7xl font-extrabold tabular-nums leading-none">{weather.current.tempF}°</div>
        <div className="text-base text-slate-300">{desc.label}</div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Stat label="High" value={`${weather.today.highF}°`} />
        <Stat label="Low"  value={`${weather.today.lowF}°`} />
        <Stat label="Rain" value={weather.today.precipPct == null ? '—' : `${weather.today.precipPct}%`} />
      </div>
      <div className="mt-3 text-[11px] text-slate-500 flex justify-between">
        <span>Wind {weather.current.windMph} mph</span>
        {weather.today.sunrise && weather.today.sunset && (
          <span>↑ {fmtSun(weather.today.sunrise)} · ↓ {fmtSun(weather.today.sunset)}</span>
        )}
      </div>
    </div>
  );
}

function fmtSun(iso) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function Stat({ label, value }) {
  return (
    <div className="bg-white/5 rounded-lg py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

/* ---------------- Today's events ---------------- */

function EventsCard({ events, kids }) {
  const colorFor = (kid_id) => kids.find(k => k.id === kid_id)?.color || '#475569';
  return (
    <Card title="Today">
      {events.length === 0 ? (
        <div className="text-slate-500 text-sm py-6 text-center">Nothing on the calendar today</div>
      ) : (
        <div className="space-y-2 overflow-auto pr-1">
          {events.map(e => (
            <div key={e.id} className="flex gap-3 items-start bg-white/[0.04] rounded-xl px-3 py-2.5">
              <div className="w-1.5 self-stretch rounded-full" style={{ background: colorFor(e.kid_id) }} />
              <div className="flex-1 min-w-0">
                <div className="text-base font-semibold truncate">{e.title}</div>
                <div className="text-xs text-slate-400 tabular-nums">
                  {e.all_day ? 'All day' : new Date(e.start_datetime).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ---------------- Dinner ---------------- */

function DinnerCard({ meal }) {
  return (
    <div className="bg-[#111923] border border-white/5 rounded-2xl p-5 flex flex-col overflow-hidden">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Tonight's Dinner</div>
      <div className="flex-1 flex items-center justify-center text-center">
        {meal?.description ? (
          <div className="text-3xl font-bold leading-tight">🍽️ {meal.description}</div>
        ) : (
          <div className="text-slate-500 text-sm">Not planned yet — set it on the Meals tab</div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Chores progress strip ---------------- */

function ChoresStrip({ kids, byKid }) {
  return (
    <div className="grid grid-cols-6 gap-3 flex-shrink-0">
      {kids.map(k => {
        const { done = 0, total = 0 } = byKid[k.id] || {};
        const pct = total === 0 ? 0 : Math.round((done / total) * 100);
        const allDone = total > 0 && done === total;
        return (
          <div key={k.id}
            className="bg-[#111923] border border-white/5 rounded-2xl p-3 flex items-center gap-3"
            style={{ boxShadow: `inset 0 3px 0 0 ${k.color}` }}>
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0"
              style={{ background: k.color }}>{k.initials}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold truncate">{k.name}</div>
              <div className="mt-1 h-2 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: k.color }} />
              </div>
              <div className="text-[11px] text-slate-400 mt-1 tabular-nums">
                {total === 0 ? 'No chores' : allDone ? '🎉 All done' : `${done}/${total} done`}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Countdown strip ---------------- */

function CountdownStrip({ birthdays, holiday }) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-3 flex-shrink-0">
      <div className="bg-[#111923] border border-white/5 rounded-2xl p-4">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">
          Birthdays {birthdays.length > 0 ? '· next 30 days' : ''}
        </div>
        {birthdays.length === 0 ? (
          <div className="text-slate-500 text-sm">No birthdays in the next 30 days. Add dates in Admin.</div>
        ) : (
          <div className="flex gap-3 overflow-x-auto">
            {birthdays.map(({ person, date, daysUntil, age }) => (
              <div key={person.id}
                className="flex items-center gap-3 bg-white/[0.04] rounded-xl px-4 py-2 flex-shrink-0"
                style={{ boxShadow: `inset 0 0 0 1px ${person.color}55` }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold"
                  style={{ background: person.color }}>{person.initials}</div>
                <div>
                  <div className="text-sm font-bold leading-tight">{person.name}</div>
                  <div className="text-[11px] text-slate-400 leading-tight tabular-nums">
                    {countdownLabel(daysUntil)} · {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    {age != null ? ` · turns ${age}` : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <HolidayCard holiday={holiday} />
    </div>
  );
}

function HolidayCard({ holiday }) {
  if (!holiday) return null;
  const days = Math.round((holiday.date - startOfDay(new Date())) / 86_400_000);
  return (
    <div className="bg-[#111923] border border-white/5 rounded-2xl p-4 flex items-center gap-3 min-w-[260px]">
      <div className="text-3xl">{holiday.emoji}</div>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Next Holiday</div>
        <div className="text-base font-bold leading-tight">{holiday.name}</div>
        <div className="text-[11px] text-slate-400 leading-tight tabular-nums">
          {countdownLabel(days)} · {holiday.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </div>
      </div>
    </div>
  );
}

function countdownLabel(days) {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `in ${days} days`;
}

/* ---------------- Card shell ---------------- */

function Card({ title, children }) {
  return (
    <div className="bg-[#111923] border border-white/5 rounded-2xl p-4 flex flex-col overflow-hidden">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">{title}</div>
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">{children}</div>
    </div>
  );
}
