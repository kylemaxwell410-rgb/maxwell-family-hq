import { useEffect, useMemo, useRef, useState } from 'react';
import { api, todayStr } from '../api.js';
import { startOfDay, endOfDay, addDays } from '../utils/dateMath.js';
import { fetchWeather, describeCode, getLocation } from '../utils/weather.js';
import { upcomingMixed } from '../utils/upcoming.js';
import { fmtTime, fmtDateShort, fmtDayOfWeek } from '../utils/format.js';
import { factForToday } from '../utils/funFacts.js';

export default function Today({ kids: allKids, onKidsChange }) {
  const peopleForChores = useMemo(() => allKids.filter(k => k.role !== 'pet'), [allKids]);

  const [chores, setChores]               = useState([]);
  const [todayEvents, setTodayEvents]     = useState([]);
  const [tomorrowEvents, setTomorrowEvents] = useState([]);
  const [meal, setMeal]                   = useState(null);
  const [weather, setWeather]             = useState(null);
  const [weatherErr, setWeatherErr]       = useState(null);
  const [settings, setSettings]           = useState({});
  const [notes, setNotes]                 = useState([]);
  const [streaks, setStreaks]             = useState({});
  const [vacations, setVacations]         = useState([]);
  const [now, setNow]                     = useState(new Date());
  const dStr = todayStr();

  async function loadEverything() {
    const today    = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());
    const tomorrow    = startOfDay(addDays(new Date(), 1));
    const tomorrowEnd = endOfDay(addDays(new Date(), 1));
    const [c, eToday, eTomorrow, m, s, n, st, v] = await Promise.all([
      api.chores(dStr),
      api.events(today.toISOString(), todayEnd.toISOString()),
      api.events(tomorrow.toISOString(), tomorrowEnd.toISOString()),
      api.meals(dStr, dStr),
      api.settings(),
      api.notes(),
      api.streaks(),
      api.vacations(),
    ]);
    setChores(c);
    setTodayEvents(eToday);
    setTomorrowEvents(eTomorrow);
    setMeal((m || []).find(x => x.meal_type === 'dinner') || null);
    setSettings(s);
    setNotes(n);
    setStreaks(st);
    setVacations(v);
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
  const upcoming       = useMemo(() => upcomingMixed(allKids, 5), [allKids]);
  const fact           = useMemo(() => factForToday(now), [now]);
  const nextVacation   = useMemo(() => {
    const today = startOfDay(new Date());
    return [...vacations]
      .filter(v => new Date(v.end_date + 'T23:59:59') >= today)
      .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))[0] || null;
  }, [vacations]);

  return (
    <div className="flex flex-col gap-3 p-3 lg:h-full lg:overflow-hidden">
      {notes.length > 0 && <NotesStrip notes={notes} />}
      <FunFactStrip fact={fact} />

      {/* Top row: Weather (wider), Today, Tomorrow, Dinner (half) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_0.55fr] gap-3 lg:h-[360px] flex-shrink-0">
        <WeatherCard weather={weather} err={weatherErr} />
        <EventsCard title="Today's Events"    events={sortedToday}    kids={allKids} />
        <EventsCard title="Tomorrow's Events" events={sortedTomorrow} kids={allKids} />
        <DinnerCard meal={meal} />
      </div>

      {/* Below the weather row: Coming Up | Next Vacation | Bedtime */}
      <BottomStrip
        upcoming={upcoming}
        bedtime={settings.bedtime}
        now={now}
        vacation={nextVacation}
      />

      {/* Bottom: chores grid (the workhorse — fills remaining space on the wall) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 lg:flex-1 lg:min-h-0">
        {peopleForChores.map(kid => (
          <PersonChoresTile
            key={kid.id}
            kid={kid}
            chores={choresByKid[kid.id] || []}
            streak={streaks[kid.id] || 0}
            onToggle={toggle}
          />
        ))}
      </div>
    </div>
  );
}

function FunFactStrip({ fact }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-xl flex-shrink-0">
      <div className="text-base emoji flex-shrink-0">🤓</div>
      <div className="text-[10px] uppercase tracking-wider text-indigo-700 font-semibold flex-shrink-0">Fun fact</div>
      <div className="text-sm text-slate-800 truncate">{fact}</div>
    </div>
  );
}

/* =================== Notes strip =================== */

function NotesStrip({ notes }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl flex-shrink-0">
      <div className="text-lg emoji flex-shrink-0">📝</div>
      <div className="text-[10px] uppercase tracking-wider text-amber-700 font-semibold flex-shrink-0">Notes</div>
      <div className="flex gap-2 overflow-x-auto">
        {notes.map(n => (
          <div key={n.id} className="text-sm text-amber-900 bg-white/60 border border-amber-200 rounded-lg px-3 py-1 flex-shrink-0">
            {n.body}
            {n.expires_on && (
              <span className="text-[10px] text-amber-600 ml-2">until {fmtDateShort(n.expires_on + 'T12:00:00')}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* =================== Weather =================== */

function WeatherCard({ weather, err }) {
  if (err)     return <Card title="Weather"><div className="text-rose-600 text-sm">{err}</div></Card>;
  if (!weather) return <Card title="Weather"><div className="text-slate-400 text-sm">Loading…</div></Card>;
  const desc = describeCode(weather.today.code);
  const loc = getLocation();
  return (
    <div className="surface p-4 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs lg:text-sm uppercase tracking-wider text-slate-400 font-semibold">Weather</div>
          <div className="text-sm lg:text-base text-slate-500">{loc.label}</div>
        </div>
        <div className="text-4xl emoji">{desc.emoji}</div>
      </div>

      {/* Top: temperature on the left, 3 big forecast tiles on the right */}
      <div className="mt-2 grid grid-cols-[auto_1fr] gap-4 items-stretch">
        <div className="flex flex-col justify-center">
          <div className="text-7xl font-extrabold tabular-nums leading-none text-slate-900">{weather.current.tempF}°</div>
          <div className="mt-1 text-xl text-slate-700 font-semibold leading-tight">{desc.label}</div>
          <div className="text-base text-slate-600 tabular-nums font-semibold">H {weather.today.highF}° · L {weather.today.lowF}°</div>
          <div className="text-base text-slate-600 tabular-nums font-semibold">
            Rain: {weather.today.precipPct ?? 0}%{precipSuffix(weather.today.precipSum)}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {weather.forecast.slice(0, 3).map((d, i) => (
            <ForecastDay key={d.date} day={d} index={i} size="lg" />
          ))}
        </div>
      </div>

      {/* Bottom: 4 small forecast tiles full-width */}
      {weather.forecast.length > 3 && (
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {weather.forecast.slice(3, 7).map((d) => (
            <ForecastDay key={d.date} day={d} index={-1} size="sm" />
          ))}
        </div>
      )}
    </div>
  );
}

function fmtPrecip(inches) {
  if (inches == null) return '0.00';
  if (inches === 0)   return '0.00';
  if (inches < 0.01)  return '<0.01';
  return inches.toFixed(2);
}

// Render the inches suffix ONLY when meaningful precip is expected.
function precipSuffix(inches) {
  if (inches == null || inches < 0.01) return '';
  return ` · ${fmtPrecip(inches)} in`;
}

function ForecastDay({ day, index, size = 'sm' }) {
  const desc = describeCode(day.code);
  const label = index === 0 ? 'TODAY' : index === 1 ? 'TMRW' :
    fmtDayOfWeek(day.date + 'T12:00:00').toUpperCase();
  if (size === 'lg') {
    // Big tile (top row): vertical stack — day label, emoji, hi/lo, rain.
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-lg text-center px-2 py-3">
        <div className="text-base uppercase tracking-wide text-slate-500 font-semibold">{label}</div>
        <div className="text-6xl emoji my-1.5 leading-tight">{desc.emoji}</div>
        <div className="text-xl tabular-nums text-slate-700 leading-tight">
          <span className="font-bold">{day.highF}°</span>
          <span className="text-slate-400"> / {day.lowF}°</span>
        </div>
        {day.precipPct != null && day.precipPct >= 10 && (
          <div className="text-base text-slate-500 tabular-nums font-semibold">{day.precipPct}% rain</div>
        )}
      </div>
    );
  }
  // Small tile (bottom row): horizontal — emoji left, day + temps + rain stacked right.
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 flex items-center gap-2">
      <div className="text-4xl emoji flex-shrink-0 leading-none">{desc.emoji}</div>
      <div className="flex-1 min-w-0 leading-tight">
        <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">{label}</div>
        <div className="text-base tabular-nums text-slate-700">
          <span className="font-bold">{day.highF}°</span>
          <span className="text-slate-400"> / {day.lowF}°</span>
        </div>
        {day.precipPct != null && day.precipPct >= 10 && (
          <div className="text-xs text-slate-500 tabular-nums font-semibold">{day.precipPct}%</div>
        )}
      </div>
    </div>
  );
}

/* =================== Events =================== */

function EventsCard({ title, events, kids }) {
  const colorFor = (kid_id) => kids.find(k => k.id === kid_id)?.color || '#94a3b8';
  return (
    <Card title={title} bigTitle>
      {events.length === 0 ? (
        <div className="text-slate-400 text-base py-6 text-center">Nothing scheduled</div>
      ) : (
        <div className="space-y-2 overflow-auto pr-1">
          {events.map(e => (
            <div key={e.id} className="flex gap-2 items-start bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <div className="w-1.5 self-stretch rounded-full" style={{ background: colorFor(e.kid_id) }} />
              <div className="flex-1 min-w-0">
                <div className="text-lg lg:text-xl font-bold truncate text-slate-900 leading-tight">{e.title}</div>
                <div className="text-sm lg:text-base text-slate-600 tabular-nums font-semibold leading-tight">
                  {e.all_day ? 'All day' : fmtTime(e.start_datetime)}
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
  const recipeUrl = meal?.description
    ? `https://www.google.com/search?q=${encodeURIComponent(meal.description + ' recipe')}`
    : null;
  return (
    <div className="surface p-3 flex flex-col overflow-hidden">
      <div className="text-xs lg:text-sm uppercase tracking-wider text-slate-400 font-semibold">Tonight's Dinner</div>
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
        {meal?.description ? (
          <>
            <div className="text-lg lg:text-xl font-extrabold leading-tight text-slate-900">
              <span className="emoji">🍽️</span> {meal.description}
            </div>
            <a href={recipeUrl} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold tap shadow-sm">
              <span className="emoji">🍴</span> Click here for recipe
            </a>
          </>
        ) : (
          <div className="text-slate-400 text-base">Not planned yet — set it on the Meals tab</div>
        )}
      </div>
    </div>
  );
}

/* =================== Person chores tile =================== */

function PersonChoresTile({ kid, chores, onToggle, streak = 0 }) {
  const done  = chores.filter(c => c.completed).length;
  const total = chores.length;
  const allDone = total > 0 && done === total;
  const earned   = chores.filter(c => c.completed).reduce((s, c) => s + c.points, 0);
  const possible = chores.reduce((s, c) => s + c.points, 0);
  const isParent = kid.role === 'parent';

  const [celebrating, setCelebrating] = useState(false);
  const prevAllDone = useRef(false);
  useEffect(() => {
    if (allDone && !prevAllDone.current) {
      setCelebrating(true);
      const t = setTimeout(() => setCelebrating(false), 4000);
      return () => clearTimeout(t);
    }
    prevAllDone.current = allDone;
  }, [allDone]);

  const needsAttention = total > 0 && !allDone && !celebrating;
  return (
    <div
      className={`relative flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden
        ${celebrating ? 'celebrate-tile' : ''}
        ${needsAttention ? 'attention-pending' : ''}`}
      style={{
        boxShadow: `inset 0 4px 0 0 ${kid.color}, 0 1px 3px rgba(15,23,42,0.06)`,
        '--attention-color': kid.color,
        '--attention-color-soft': `${kid.color}1F`, // ~12% alpha tint
      }}
    >
      {celebrating && <ConfettiOverlay color={kid.color} />}
      <div className="px-3 pt-2.5 pb-2 flex items-center justify-between border-b border-slate-100"
        style={{ background: `linear-gradient(180deg, ${kid.color}1A 0%, transparent 100%)` }}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-11 h-11 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0 text-white"
            style={{ background: kid.color }}>{kid.initials}</div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <div className="text-xl lg:text-2xl font-extrabold leading-tight truncate text-slate-900 uppercase tracking-wide"
                style={{ color: kid.color }}>
                {kid.name}
              </div>
              {streak >= 2 && (
                <div className="flex items-center text-xs font-bold text-orange-600 bg-orange-100 rounded-full px-1.5 py-0.5 leading-none flex-shrink-0"
                  title={`${streak}-day streak`}>
                  <span className="emoji mr-0.5">🔥</span>{streak}
                </div>
              )}
            </div>
            <div className="text-xs text-slate-500 leading-tight mt-0.5">
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

      <div className="flex-1 p-2 overflow-auto space-y-1.5">
        {chores.length === 0 ? (
          <div className="text-slate-400 text-center py-3 text-xs">No chores scheduled today</div>
        ) : allDone ? (
          <AllDoneBody kid={kid} earned={earned} streak={streak} isParent={isParent} onToggle={onToggle} chores={chores} />
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
              <div className="text-sm font-bold truncate uppercase tracking-wide">{c.title}</div>
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

// Big "All Done!" body that takes over the chore list once everything is checked off.
// Visible from across the room. Tapping anywhere on it lets you uncheck a chore (long-press
// on a chore title shows the list to undo) — keeping it simple: just a big celebration card.
function AllDoneBody({ kid, earned, streak, isParent, chores, onToggle }) {
  const [showList, setShowList] = useState(false);
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-2 py-3 relative"
      style={{
        background: `linear-gradient(180deg, ${kid.color}1F 0%, ${kid.color}08 100%)`,
        borderRadius: 12,
      }}>
      <div className="text-7xl emoji mb-1 leading-none" style={{ filter: `drop-shadow(0 2px 4px ${kid.color}55)` }}>🎉</div>
      <div className="text-3xl lg:text-4xl font-extrabold leading-tight uppercase tracking-wide" style={{ color: kid.color }}>All Done!</div>
      <div className="mt-2 text-lg lg:text-xl text-slate-800 font-bold">
        {isParent ? `${chores.length}/${chores.length} chores` : <>+{earned} pts today</>}
      </div>
      {streak >= 2 && (
        <div className="mt-3 inline-flex items-center gap-1.5 text-base lg:text-lg font-bold text-orange-700 bg-orange-100 rounded-full px-4 py-1.5">
          <span className="emoji">🔥</span>{streak}-day streak
        </div>
      )}
      <button
        onClick={() => setShowList(s => !s)}
        className="mt-4 text-sm lg:text-base text-slate-600 font-semibold underline tap min-h-0 px-3 py-1">
        {showList ? 'hide' : 'undo a chore'}
      </button>
      {showList && (
        <div className="mt-2 w-full space-y-1 text-left">
          {chores.map(c => (
            <button key={c.id} onClick={() => onToggle(c)}
              className="w-full flex items-center gap-2 px-2 py-1 rounded-md text-xs bg-white border border-slate-200 hover:bg-slate-50">
              <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0" style={{ background: kid.color }}>
                <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="white" strokeWidth="3">
                  <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="flex-1 truncate text-slate-600 line-through uppercase tracking-wide">{c.title}</span>
              {!isParent && <span className="text-slate-400">+{c.points}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ConfettiOverlay({ color }) {
  const pieces = useMemo(() =>
    Array.from({ length: 24 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.4,
      duration: 1.2 + Math.random() * 1.6,
      dx: (Math.random() - 0.5) * 80,
      glyph: ['🎉', '✨', '⭐️', '🌟', '🎊'][i % 5],
    })), []);
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
      {pieces.map(p => (
        <span key={p.id} className="confetti-piece emoji"
          style={{
            left: `${p.left}%`,
            color,
            animationDelay: `${p.delay}s`,
            '--dur': `${p.duration}s`,
            '--dx': `${p.dx}px`,
          }}>
          {p.glyph}
        </span>
      ))}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-2xl font-extrabold text-slate-900 bg-white/80 px-3 py-1 rounded-full shadow-md emoji">
          🎉 All done!
        </div>
      </div>
    </div>
  );
}

/* =================== Bottom strip =================== */

// Bottom row: Coming Up sized to its chips (auto), Next Vacation fills the
// remaining space (1fr), Bedtime pinned right (auto). On phones the three
// stack vertically.
function BottomStrip({ upcoming, bedtime, now, vacation }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[max-content_minmax(0,1fr)_max-content] gap-3 flex-shrink-0 lg:h-[150px]">
      <UpcomingCard items={upcoming} />
      <NextVacationCard vacation={vacation} />
      <BedtimeCard bedtime={bedtime} now={now} />
    </div>
  );
}

function NextVacationCard({ vacation }) {
  if (!vacation) {
    return (
      <div className="surface p-3 flex items-center gap-3">
        <div className="text-4xl emoji">🌴</div>
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Next Vacation</div>
          <div className="text-base text-slate-400">No trips on the books — add one in Admin → Vacations</div>
        </div>
      </div>
    );
  }
  const today = startOfDay(new Date());
  const start = new Date(vacation.start_date + 'T00:00:00');
  const end   = new Date(vacation.end_date   + 'T00:00:00');
  const inProgress = today >= start && today <= end;
  const days = Math.round((start - today) / 86_400_000);
  const range = (() => {
    const sShort = fmtDateShort(start);
    const eShort = fmtDateShort(end);
    if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
      return `${sShort.split(' ')[0]} ${start.getDate()}–${end.getDate()}`;
    }
    return `${sShort} – ${eShort}`;
  })();
  return (
    <div className="surface p-3 flex items-center gap-4">
      <div className="text-6xl emoji flex-shrink-0">🌴</div>
      <div className="min-w-0 flex-1">
        <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Next Vacation</div>
        <div className="text-lg lg:text-xl font-extrabold leading-tight text-slate-900 truncate">
          {vacation.title}{vacation.location ? <span className="font-normal text-slate-500"> · {vacation.location}</span> : null}
        </div>
        <div className="text-sm lg:text-base text-slate-600 leading-tight tabular-nums font-semibold">
          {inProgress ? '🌞 Right now!' : days === 0 ? 'Starts today' : days === 1 ? 'Tomorrow' : `in ${days} days`}
          {' · '}{range}
        </div>
      </div>
    </div>
  );
}

function UpcomingCard({ items }) {
  return (
    <div className="surface p-3 flex flex-col overflow-hidden">
      <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1.5">Coming Up</div>
      {items.length === 0 ? (
        <div className="text-slate-400 text-sm flex-1 flex items-center">Nothing on the horizon.</div>
      ) : (
        <div className="flex gap-2 flex-1 items-center overflow-x-auto">
          {items.map(item => (
            <div key={item.key}
              className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex-shrink-0">
              {item.type === 'birthday' ? (
                <div className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-base text-white flex-shrink-0"
                  style={{ background: item.color }}>{item.person.initials}</div>
              ) : (
                <div className="text-3xl emoji flex-shrink-0">{item.emoji}</div>
              )}
              <div>
                <div className="text-base font-extrabold leading-tight text-slate-900 truncate max-w-[180px]">
                  {item.type === 'birthday' ? `${item.label}'s Birthday` : item.label}
                </div>
                <div className="text-xs text-slate-500 leading-tight tabular-nums font-semibold">
                  {countdownLabel(item.daysUntil)} · {fmtDateShort(item.date)}
                  {item.type === 'birthday' && item.age != null ? ` · turns ${item.age}` : ''}
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
    <div className="surface p-3 flex items-center gap-3 min-w-[280px]">
      <div className="text-6xl emoji">🌙</div>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Bedtime</div>
        {info ? (
          <>
            <div className="text-2xl lg:text-3xl font-extrabold leading-tight text-slate-900 tabular-nums">{info.label}</div>
            <div className="text-base lg:text-lg text-slate-600 tabular-nums font-semibold">at {info.timeLabel}</div>
          </>
        ) : (
          <div className="text-sm text-slate-400">Set bedtime in Admin</div>
        )}
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
  const timeLabel = fmtTime(target);
  const diffMs = target - now;
  if (diffMs <= 0) return { label: 'Past bedtime', timeLabel };
  const totalMin = Math.floor(diffMs / 60_000);
  const hours = Math.floor(totalMin / 60);
  const mins  = totalMin % 60;
  const label = hours > 0 ? `in ${hours}h ${mins}m` : `in ${mins}m`;
  return { label, timeLabel };
}

/* =================== Card shell =================== */

function Card({ title, children, bigTitle }) {
  return (
    <div className="surface p-3 flex flex-col overflow-hidden">
      <div className={`uppercase tracking-wider text-slate-400 font-semibold mb-1.5
        ${bigTitle ? 'text-xs lg:text-sm' : 'text-[10px]'}`}>{title}</div>
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">{children}</div>
    </div>
  );
}
