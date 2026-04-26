import { useEffect, useMemo, useRef, useState } from 'react';
import { api, todayStr } from '../api.js';
import { startOfDay, endOfDay, addDays } from '../utils/dateMath.js';
import { fetchWeather, describeCode, getLocation, isWetForecast } from '../utils/weather.js';
import { upcomingMixed } from '../utils/upcoming.js';
import { suggestActivity } from '../utils/bored.js';
import { fmtTime, fmtDateShort, fmtDayOfWeek } from '../utils/format.js';

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
  const [now, setNow]                     = useState(new Date());
  const [boredOpen, setBoredOpen]         = useState(false);
  const [askOpen, setAskOpen]             = useState(false);
  const dStr = todayStr();

  async function loadEverything() {
    const today    = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());
    const tomorrow    = startOfDay(addDays(new Date(), 1));
    const tomorrowEnd = endOfDay(addDays(new Date(), 1));
    const [c, eToday, eTomorrow, m, s, n] = await Promise.all([
      api.chores(dStr),
      api.events(today.toISOString(), todayEnd.toISOString()),
      api.events(tomorrow.toISOString(), tomorrowEnd.toISOString()),
      api.meals(dStr, dStr),
      api.settings(),
      api.notes(),
    ]);
    setChores(c);
    setTodayEvents(eToday);
    setTomorrowEvents(eTomorrow);
    setMeal((m || []).find(x => x.meal_type === 'dinner') || null);
    setSettings(s);
    setNotes(n);
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
  const wetWeather     = useMemo(() => isWetForecast(weather), [weather]);

  return (
    <div className="h-full flex flex-col p-3 gap-3 overflow-hidden relative">
      {/* Family notes strip (only renders when notes exist; tappable to dismiss requires PIN via Admin) */}
      {notes.length > 0 && <NotesStrip notes={notes} />}

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

      {/* Bottom: combined upcoming countdown (left) + bedtime (right) */}
      <BottomStrip upcoming={upcoming} bedtime={settings.bedtime} now={now} />

      {/* Floating action buttons */}
      <FloatingActions
        onAsk={() => setAskOpen(true)}
        onBored={() => setBoredOpen(true)}
      />

      {boredOpen && <BoredModal wet={wetWeather} onClose={() => setBoredOpen(false)} />}
      {askOpen   && <AskModal kids={peopleForChores.filter(k => k.role === 'kid')} onClose={() => setAskOpen(false)} />}
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
            H {weather.today.highF}° · L {weather.today.lowF}°
          </div>
          <div className="text-[11px] text-slate-500 tabular-nums">
            Rain: {weather.today.precipPct ?? 0}% · {fmtPrecip(weather.today.precipSum)} in
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

function fmtPrecip(inches) {
  if (inches == null) return '0.00';
  if (inches === 0)   return '0.00';
  if (inches < 0.01)  return '<0.01';
  return inches.toFixed(2);
}

function ForecastDay({ day, index }) {
  const desc = describeCode(day.code);
  const label = index === 0 ? 'Today' : index === 1 ? 'Tomorrow' :
    fmtDayOfWeek(day.date + 'T12:00:00');
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-center">
      <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">{label}</div>
      <div className="text-2xl leading-tight emoji">{desc.emoji}</div>
      <div className="text-xs tabular-nums text-slate-700">
        <span className="font-bold">{day.highF}°</span>
        <span className="text-slate-400"> / {day.lowF}°</span>
      </div>
      <div className="text-[10px] text-slate-400 tabular-nums">
        {day.precipPct == null ? '' : `${day.precipPct}% · ${fmtPrecip(day.precipSum)}″`}
      </div>
    </div>
  );
}

/* =================== Events =================== */

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

  return (
    <div
      className={`relative flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden ${celebrating ? 'celebrate-tile' : ''}`}
      style={{ boxShadow: `inset 0 4px 0 0 ${kid.color}, 0 1px 3px rgba(15,23,42,0.06)` }}
    >
      {celebrating && <ConfettiOverlay color={kid.color} />}
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

/* =================== Bottom strip: upcoming (left) + bedtime (right) =================== */

function BottomStrip({ upcoming, bedtime, now }) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-3 flex-shrink-0 h-[110px]">
      <UpcomingCard items={upcoming} />
      <BedtimeCard bedtime={bedtime} now={now} />
    </div>
  );
}

function UpcomingCard({ items }) {
  return (
    <div className="surface p-3 flex flex-col overflow-hidden">
      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1.5">Coming Up</div>
      {items.length === 0 ? (
        <div className="text-slate-400 text-xs flex-1 flex items-center">Nothing on the horizon.</div>
      ) : (
        <div className="flex gap-2 flex-1 items-center overflow-x-auto">
          {items.map(item => (
            <div key={item.key}
              className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 flex-shrink-0">
              {item.type === 'birthday' ? (
                <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-white flex-shrink-0"
                  style={{ background: item.color }}>{item.person.initials}</div>
              ) : (
                <div className="text-2xl emoji flex-shrink-0">{item.emoji}</div>
              )}
              <div>
                <div className="text-sm font-bold leading-tight text-slate-900 truncate max-w-[160px]">
                  {item.type === 'birthday' ? `${item.label}'s Birthday` : item.label}
                </div>
                <div className="text-[10px] text-slate-500 leading-tight tabular-nums">
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

/* =================== Floating actions =================== */

function FloatingActions({ onAsk, onBored }) {
  return (
    <div className="absolute right-5 bottom-32 flex flex-col gap-3 z-30">
      <button onClick={onBored}
        className="w-16 h-16 rounded-full bg-amber-400 hover:bg-amber-300 text-slate-900 shadow-lg flex items-center justify-center text-2xl tap"
        title="I'm bored — give me an idea!">
        <span className="emoji">💡</span>
      </button>
      <button onClick={onAsk}
        className="w-16 h-16 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg flex items-center justify-center text-2xl tap"
        title="Ask Claude a question">
        <span className="emoji">💬</span>
      </button>
    </div>
  );
}

/* =================== Bored modal =================== */

function BoredModal({ wet, onClose }) {
  const [idea, setIdea] = useState(() => suggestActivity({ wet }));
  return (
    <Modal onClose={onClose} title="Try this!">
      <div className="px-1 py-2">
        <div className="text-2xl mb-2 emoji">{wet ? '☔️' : '☀️'}</div>
        <p className="text-xl font-semibold text-slate-900 leading-snug">{idea}</p>
        <p className="text-xs text-slate-500 mt-2">{wet ? 'Indoor pick — looks wet today.' : 'Get outside!'}</p>
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={() => setIdea(suggestActivity({ wet, prev: idea }))}
          className="flex-1 py-3 bg-amber-400 hover:bg-amber-300 text-slate-900 rounded-xl font-semibold tap">
          Another idea
        </button>
        <button onClick={onClose}
          className="px-6 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl font-semibold tap">Close</button>
      </div>
    </Modal>
  );
}

/* =================== Ask Claude modal =================== */

function AskModal({ kids, onClose }) {
  const [question, setQuestion] = useState('');
  const [kidName, setKidName]   = useState(kids[0]?.name || '');
  const [answer, setAnswer]     = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  async function ask() {
    if (!question.trim()) return;
    setLoading(true); setError(null); setAnswer('');
    try {
      const r = await api.askBot(question, kidName);
      setAnswer(r.answer);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal onClose={onClose} title="Ask Claude">
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Who's asking?</label>
          <div className="flex flex-wrap gap-2">
            {kids.map(k => (
              <button key={k.id} onClick={() => setKidName(k.name)}
                className={`px-3 py-2 rounded-lg text-sm font-semibold tap border
                  ${kidName === k.name ? 'border-slate-400 bg-slate-100' : 'border-slate-200 hover:bg-slate-50'}`}>
                {k.name}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Your question</label>
          <textarea
            className="w-full bg-white border border-slate-300 rounded-xl p-3 text-base text-slate-900 min-h-[88px]"
            placeholder="What do you want to know?"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            autoFocus
          />
        </div>
        {answer && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-slate-900 whitespace-pre-wrap text-sm">
            {answer}
          </div>
        )}
        {error && <div className="text-rose-600 text-sm">{error}</div>}
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={ask} disabled={loading || !question.trim()}
          className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl font-semibold tap">
          {loading ? 'Thinking…' : answer ? 'Ask another' : 'Ask'}
        </button>
        <button onClick={onClose}
          className="px-6 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl font-semibold tap">Close</button>
      </div>
    </Modal>
  );
}

/* =================== Modal shell =================== */

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl p-6 w-[560px] max-h-[90vh] overflow-auto"
        onClick={e => e.stopPropagation()}>
        {title && <h3 className="text-xl font-bold mb-3 text-slate-900">{title}</h3>}
        {children}
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

function Card({ title, children }) {
  return (
    <div className="surface p-3 flex flex-col overflow-hidden">
      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1.5">{title}</div>
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">{children}</div>
    </div>
  );
}
