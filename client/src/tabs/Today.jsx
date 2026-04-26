import { useEffect, useMemo, useState } from 'react';
import { api, todayStr } from '../api.js';
import { startOfDay, endOfDay, addDays } from '../utils/dateMath.js';
import { fetchWeather, describeCode, getLocation } from '../utils/weather.js';
import { upcomingBirthdays, nextBirthdayAny } from '../utils/birthdays.js';
import { nextHoliday } from '../utils/holidays.js';

export default function Today({ kids: allKids, onKidsChange }) {
  const peopleForChores = useMemo(() => allKids.filter(k => k.role !== 'pet'), [allKids]);

  const [chores, setChores]               = useState([]);
  const [todayEvents, setTodayEvents]     = useState([]);
  const [tomorrowEvents, setTomorrowEvents] = useState([]);
  const [meal, setMeal]                   = useState(null);
  const [weather, setWeather]             = useState(null);
  const [weatherErr, setWeatherErr]       = useState(null);
  const [settings, setSettings]           = useState({});
  const [now, setNow]                     = useState(new Date());
  const dStr = todayStr();

  async function loadEverything() {
    const today    = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());
    const tomorrow    = startOfDay(addDays(new Date(), 1));
    const tomorrowEnd = endOfDay(addDays(new Date(), 1));
    const [c, eToday, eTomorrow, m, s] = await Promise.all([
      api.chores(dStr),
      api.events(today.toISOString(), todayEnd.toISOString()),
      api.events(tomorrow.toISOString(), tomorrowEnd.toISOString()),
      api.meals(dStr, dStr),
      api.settings(),
    ]);
    setChores(c);
    setTodayEvents(eToday);
    setTomorrowEvents(eTomorrow);
    setMeal((m || []).find(x => x.meal_type === 'dinner') || null);
    setSettings(s);
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
    const id = setInterval(load, 15 * 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  async function toggle(chore) {
    if (chore.completed) await api.uncompleteChore(chore.id, dStr);
    else                 await api.completeChore(chore.id, dStr);
    await loadEverything();
    onKidsChange?.();
  }

  const choresByKid = useMemo(() => {
    const map = {};
    for (const k of peopleForChores) map[k.id] = [];
    for (const c of chores) (map[c.kid_id] ||= []).push(c);
    return map;
  }, [chores, peopleForChores]);

  const sortedToday    = useMemo(() => [...todayEvents].sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime)), [todayEvents]);
  const sortedTomorrow = useMemo(() => [...tomorrowEvents].sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime)), [tomorrowEvents]);

  const birthdaysToShow = useMemo(() => {
    const within30 = upcomingBirthdays(allKids, new Date(), 30);
    if (within30.length > 0) return within30;
    const next = nextBirthdayAny(allKids);
    return next ? [next] : [];
  }, [allKids]);
  const holiday = useMemo(() => nextHoliday(), []);

  return (
    <div className="h-full flex flex-col p-3 gap-3 overflow-hidden">
      {/* Top row: Weather, Today, Tomorrow, Dinner */}
      <div className="grid grid-cols-[1.1fr_1fr_1fr_1fr] gap-3 h-[230px] flex-shrink-0">
        <WeatherCard weather={weather} err={weatherErr} />
        <EventsCard title="Today's Events"    events={sortedToday}    kids={allKids} />
        <EventsCard title="Tomorrow's Events" events={sortedTomorrow} kids={allKids} />
        <DinnerCard meal={meal} />
      </div>

      {/* MAIN: chores grid */}
      <div className="grid grid-cols-6 gap-3 flex-1 min-h-0">
        {peopleForChores.map(kid => (
          <PersonChoresTile
            key={kid.id}
            kid={kid}
            chores={choresByKid[kid.id] || []}
            onToggle={toggle}
          />
        ))}
      </div>

      {/* Bottom: countdowns */}
      <CountdownStrip
        birthdays={birthdaysToShow}
        holiday={holiday}
        bedtime={settings.bedtime}
        now={now}
      />
    </div>
  );
}

/* =================== Weather (with 3-day forecast) =================== */

function WeatherCard({ weather, err }) {
  if (err)     return <Card title="Weather"><div className="text-rose-600 text-sm">{err}</div></Card>;
  if (!weather) return <Card title="Weather"><div className="text-slate-400 text-sm">Loading…</div></Card>;
  const desc = describeCode(weather.today.code);
  const loc = getLocation();
  return (
    <div className="surface p-4 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Weather</div>
          <div className="text-xs text-slate-500">{loc.label}</div>
        </div>
        <div className="text-3xl emoji">{desc.emoji}</div>
      </div>
      <div className="mt-1 flex items-center gap-3">
        <div className="text-5xl font-extrabold tabular-nums leading-none text-slate-900">{weather.current.tempF}°</div>
        <div>
          <div className="text-sm text-slate-700">{desc.label}</div>
          <div className="text-[11px] text-slate-500 tabular-nums">
            H {weather.today.highF}° · L {weather.today.lowF}° · {weather.today.precipPct ?? 0}% rain
          </div>
        </div>
      </div>

      <div className="mt-auto grid grid-cols-3 gap-2 pt-2">
        {weather.forecast.map((d, i) => (
          <ForecastDay key={d.date} day={d} index={i} />
        ))}
      </div>
    </div>
  );
}

function ForecastDay({ day, index }) {
  const desc = describeCode(day.code);
  const label = index === 0 ? 'Today' : index === 1 ? 'Tomorrow' :
    new Date(day.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' });
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-center">
      <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">{label}</div>
      <div className="text-2xl leading-tight emoji">{desc.emoji}</div>
      <div className="text-xs tabular-nums text-slate-700">
        <span className="font-bold">{day.highF}°</span>
        <span className="text-slate-400"> / {day.lowF}°</span>
      </div>
      <div className="text-[10px] text-slate-400 tabular-nums">
        {day.precipPct == null ? '' : `${day.precipPct}% rain`}
      </div>
    </div>
  );
}

/* =================== Events (today / tomorrow) =================== */

function EventsCard({ title, events, kids }) {
  const colorFor = (kid_id) => kids.find(k => k.id === kid_id)?.color || '#94a3b8';
  return (
    <Card title={title}>
      {events.length === 0 ? (
        <div className="text-slate-400 text-sm py-4 text-center">Nothing scheduled</div>
      ) : (
        <div className="space-y-1.5 overflow-auto pr-1">
          {events.map(e => (
            <div key={e.id} className="flex gap-2 items-start bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
              <div className="w-1 self-stretch rounded-full" style={{ background: colorFor(e.kid_id) }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate text-slate-900">{e.title}</div>
                <div className="text-[10px] text-slate-500 tabular-nums">
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

/* =================== Dinner =================== */

function DinnerCard({ meal }) {
  return (
    <div className="surface p-4 flex flex-col overflow-hidden">
      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Tonight's Dinner</div>
      <div className="flex-1 flex items-center justify-center text-center">
        {meal?.description ? (
          <div className="text-2xl font-bold leading-tight text-slate-900">
            <span className="emoji">🍽️</span> {meal.description}
          </div>
        ) : (
          <div className="text-slate-400 text-xs">Not planned yet — set it on the Meals tab</div>
        )}
      </div>
    </div>
  );
}

/* =================== Person chores tile =================== */

function PersonChoresTile({ kid, chores, onToggle }) {
  const done  = chores.filter(c => c.completed).length;
  const total = chores.length;
  const allDone = total > 0 && done === total;
  const earned   = chores.filter(c => c.completed).reduce((s, c) => s + c.points, 0);
  const possible = chores.reduce((s, c) => s + c.points, 0);
  const isParent = kid.role === 'parent';

  return (
    <div
      className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
      style={{ boxShadow: `inset 0 4px 0 0 ${kid.color}, 0 1px 3px rgba(15,23,42,0.06)` }}
    >
      {/* Header */}
      <div className="px-3 pt-2.5 pb-2 flex items-center justify-between border-b border-slate-100"
        style={{ background: `linear-gradient(180deg, ${kid.color}1A 0%, transparent 100%)` }}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-11 h-11 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0 text-white"
            style={{ background: kid.color }}>{kid.initials}</div>
          <div className="min-w-0">
            <div className="text-base font-bold leading-tight truncate text-slate-900">{kid.name}</div>
            <div className="text-[10px] text-slate-500 leading-tight">
              {total === 0 ? 'No chores today' :
                allDone ? <><span className="emoji">🎉</span> All done</> :
                isParent ? `${done}/${total} done` : `${done}/${total} · ${earned}/${possible} pts`}
            </div>
          </div>
        </div>
        {!isParent && (
          <div className="text-right flex-shrink-0">
            <div className="text-2xl font-bold tabular-nums leading-tight text-slate-900">{kid.points_balance}</div>
            <div className="text-[9px] text-slate-400 uppercase tracking-wide leading-none">pts</div>
          </div>
        )}
      </div>

      {/* Chore list */}
      <div className="flex-1 p-2 overflow-auto space-y-1.5">
        {chores.length === 0 ? (
          <div className="text-slate-400 text-center py-3 text-xs">No chores scheduled today</div>
        ) : chores.map(c => (
          <button
            key={c.id}
            onClick={() => onToggle(c)}
            className={`w-full flex items-center gap-2 p-2 rounded-lg transition tap text-left border
              ${c.completed
                ? 'bg-slate-50 text-slate-400 line-through border-slate-100'
                : 'bg-white hover:bg-slate-50 text-slate-900 border-slate-200'}`}
          >
            <div className={`w-8 h-8 rounded-md border-2 flex items-center justify-center flex-shrink-0
              ${c.completed ? 'border-transparent' : 'border-slate-300'}`}
              style={c.completed ? { background: kid.color } : {}}>
              {c.completed && (
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="white" strokeWidth="3">
                  <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{c.title}</div>
            </div>
            {!isParent && (
              <div className="text-[11px] font-semibold px-1.5 py-0.5 rounded"
                style={{ background: kid.color + '22', color: c.completed ? '#94a3b8' : kid.color }}>
                +{c.points}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

/* =================== Countdown strip =================== */

function CountdownStrip({ birthdays, holiday, bedtime, now }) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] gap-3 flex-shrink-0 h-[110px]">
      <BirthdaysCard birthdays={birthdays} />
      <BedtimeCard bedtime={bedtime} now={now} />
      <HolidayCard holiday={holiday} />
    </div>
  );
}

function BirthdaysCard({ birthdays }) {
  const showingMany = birthdays.length > 1;
  return (
    <div className="surface p-3 flex flex-col overflow-hidden">
      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1.5">
        {showingMany ? 'Upcoming Birthdays · next 30 days' : 'Next Birthday'}
      </div>
      {birthdays.length === 0 ? (
        <div className="text-slate-400 text-xs flex-1 flex items-center">
          No birthdays on file. Add dates in Admin.
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto flex-1 items-center">
          {birthdays.map(({ person, date, daysUntil, age }) => (
            <div key={person.id}
              className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 flex-shrink-0">
              <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-white"
                style={{ background: person.color }}>{person.initials}</div>
              <div>
                <div className="text-sm font-bold leading-tight text-slate-900">{person.name}</div>
                <div className="text-[10px] text-slate-500 leading-tight tabular-nums">
                  {countdownLabel(daysUntil)} · {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  {age != null ? ` · turns ${age}` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BedtimeCard({ bedtime, now }) {
  const info = bedtime ? bedtimeCountdown(bedtime, now) : null;
  return (
    <div className="surface p-3 flex items-center gap-3 min-w-[230px]">
      <div className="text-3xl emoji">🌙</div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Bedtime</div>
        {info ? (
          <>
            <div className="text-base font-bold leading-tight text-slate-900">{info.label}</div>
            <div className="text-[10px] text-slate-500 tabular-nums">at {info.timeLabel}</div>
          </>
        ) : (
          <div className="text-xs text-slate-400">Set bedtime in Admin</div>
        )}
      </div>
    </div>
  );
}

function HolidayCard({ holiday }) {
  if (!holiday) return null;
  const days = Math.round((holiday.date - startOfDay(new Date())) / 86_400_000);
  return (
    <div className="surface p-3 flex items-center gap-3 min-w-[230px]">
      <div className="text-3xl emoji">{holiday.emoji}</div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Next Holiday</div>
        <div className="text-base font-bold leading-tight truncate text-slate-900">{holiday.name}</div>
        <div className="text-[10px] text-slate-500 leading-tight tabular-nums">
          {countdownLabel(days)} · {holiday.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </div>
      </div>
    </div>
  );
}

/* =================== Helpers =================== */

function countdownLabel(days) {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `in ${days} days`;
}

function bedtimeCountdown(bedtimeHHMM, now) {
  const [hh, mm] = bedtimeHHMM.split(':').map(n => parseInt(n, 10));
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  const target = new Date(now);
  target.setHours(hh, mm, 0, 0);
  const timeLabel = target.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const diffMs = target - now;
  if (diffMs <= 0) return { label: 'Past bedtime', timeLabel };
  const totalMin = Math.floor(diffMs / 60_000);
  const hours = Math.floor(totalMin / 60);
  const mins  = totalMin % 60;
  const label = hours > 0 ? `in ${hours}h ${mins}m` : `in ${mins}m`;
  return { label, timeLabel };
}

/* =================== Card shell =================== */

function Card({ title, children }) {
  return (
    <div className="surface p-3 flex flex-col overflow-hidden">
      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1.5">{title}</div>
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">{children}</div>
    </div>
  );
}
