import { useEffect, useMemo, useState } from 'react';
import { api, todayStr } from '../api.js';

function startOfDay(d) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function endOfDay(d)   { const x = new Date(d); x.setHours(23,59,59,999); return x; }

function fmtEventTime(iso, allDay) {
  if (allDay) return 'All day';
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function Chores({ kids, onKidsChange }) {
  const [chores, setChores] = useState([]);
  const [events, setEvents] = useState([]);
  const [date] = useState(todayStr());
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    setLoading(true);
    try {
      const today = startOfDay(new Date());
      const tomorrowEnd = endOfDay(addDays(today, 1));
      const [c, e] = await Promise.all([
        api.chores(date),
        api.events(today.toISOString(), tomorrowEnd.toISOString()),
      ]);
      setChores(c);
      setEvents(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, [date]);

  async function toggle(chore) {
    if (chore.completed) await api.uncompleteChore(chore.id, date);
    else await api.completeChore(chore.id, date);
    await loadAll();
    onKidsChange?.();
  }

  const byKid = useMemo(() => {
    const map = {};
    for (const k of kids) map[k.id] = [];
    for (const c of chores) (map[c.kid_id] ||= []).push(c);
    return map;
  }, [chores, kids]);

  const eventsByPerson = useMemo(() => {
    const map = { _family: [] };
    for (const k of kids) map[k.id] = [];
    for (const e of events) {
      if (e.kid_id && map[e.kid_id]) map[e.kid_id].push(e);
      else map._family.push(e);
    }
    return map;
  }, [events, kids]);

  if (loading && !chores.length) {
    return <div className="p-8 text-slate-400">Loading chores…</div>;
  }

  return (
    <div className="h-full overflow-auto p-5">
      <div className="grid grid-cols-3 grid-rows-2 gap-4 h-full">
        {kids.map(kid => {
          const list = byKid[kid.id] || [];
          const done = list.filter(c => c.completed).length;
          const total = list.length;
          const earnedPoints = list.filter(c => c.completed).reduce((s, c) => s + c.points, 0);
          const possiblePoints = list.reduce((s, c) => s + c.points, 0);
          const allDone = total > 0 && done === total;
          const personalEvents = [
            ...(eventsByPerson[kid.id] || []),
            ...eventsByPerson._family,
          ].sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime));
          const isParent = kid.role === 'parent';

          return (
            <div key={kid.id}
              className={`flex flex-col rounded-2xl border overflow-hidden transition
                ${allDone ? 'border-white/20' : 'border-white/5'}
                bg-[#111923]`}
              style={{ boxShadow: `inset 0 3px 0 0 ${kid.color}` }}>
              {/* Header */}
              <div className="px-4 pt-3 pb-2 flex items-center justify-between"
                style={{ background: `linear-gradient(180deg, ${kid.color}33 0%, transparent 100%)` }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{ background: kid.color }}>
                    {kid.initials}
                  </div>
                  <div>
                    <div className="text-lg font-bold leading-tight">{kid.name}</div>
                    <div className="text-[11px] text-slate-400 leading-tight">
                      {total === 0 ? 'No chores today' : `${done}/${total} done${isParent ? '' : ` · ${earnedPoints}/${possiblePoints} pts`}`}
                    </div>
                  </div>
                </div>
                {!isParent && (
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wide leading-none">Balance</div>
                    <div className="text-2xl font-bold tabular-nums leading-tight">{kid.points_balance}</div>
                  </div>
                )}
              </div>

              {/* Body: either the chore list OR the free-time panel */}
              <div className="flex-1 p-3 overflow-auto">
                {allDone ? (
                  <FreeTimeCard person={kid} events={personalEvents} />
                ) : list.length === 0 ? (
                  <div className="text-slate-500 text-center py-6 text-sm">
                    No chores scheduled today
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {list.map(c => (
                      <button
                        key={c.id}
                        onClick={() => toggle(c)}
                        className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl transition tap text-left
                          ${c.completed
                            ? 'bg-white/5 text-slate-500 line-through'
                            : 'bg-white/5 hover:bg-white/10'}`}
                      >
                        <div className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center flex-shrink-0
                          ${c.completed ? 'border-transparent' : 'border-white/20'}`}
                          style={c.completed ? { background: kid.color } : {}}>
                          {c.completed && (
                            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="white" strokeWidth="3">
                              <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[15px] font-medium truncate">{c.title}</div>
                        </div>
                        {!isParent && (
                          <div className="text-xs font-semibold px-2 py-0.5 rounded-md"
                            style={{ background: kid.color + '33', color: c.completed ? '#64748b' : '#fff' }}>
                            +{c.points}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FreeTimeCard({ person, events }) {
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = startOfDay(addDays(today, 1));
  const todayEvents    = events.filter(e => startOfDay(new Date(e.start_datetime)).getTime() === today.getTime());
  const tomorrowEvents = events.filter(e => startOfDay(new Date(e.start_datetime)).getTime() === tomorrow.getTime());

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 py-2 text-center">
        <div className="text-3xl mb-1">🎉</div>
        <div className="text-base font-bold" style={{ color: person.color }}>
          Free time!
        </div>
        <div className="text-[11px] text-slate-400 uppercase tracking-wide">
          All chores done
        </div>
      </div>
      <div className="flex-1 overflow-auto mt-1 space-y-2">
        <EventGroup label="Today" events={todayEvents} color={person.color} />
        <EventGroup label="Tomorrow" events={tomorrowEvents} color={person.color} />
      </div>
    </div>
  );
}

function EventGroup({ label, events, color }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-1 px-1">
        {label}
      </div>
      {events.length === 0 ? (
        <div className="text-xs text-slate-600 px-1 italic">Nothing on the calendar</div>
      ) : (
        <div className="space-y-1">
          {events.map(e => (
            <div key={e.id} className="flex gap-2 items-start bg-white/[0.03] rounded-md px-2 py-1.5">
              <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: color }} />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium truncate">{e.title}</div>
                <div className="text-[10px] text-slate-500 tabular-nums">{fmtEventTime(e.start_datetime, e.all_day)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
