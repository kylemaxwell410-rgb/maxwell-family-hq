import { useEffect, useMemo, useRef, useState } from 'react';
import { api, todayStr } from '../api.js';
import PinModal from '../components/PinModal.jsx';

const FAVORITE_CHORES = ['Make bed', 'Homework', 'Tidy room', 'Feed pets'];

function parseQuickAdd(text, kids) {
  const t = text.trim();
  if (!t) return null;
  const sep = /[:\s]+/;
  const idx = t.search(sep);
  if (idx <= 0) return null;
  const name = t.slice(0, idx).replace(/[:\s]+$/, '').toLowerCase();
  const title = t.slice(idx).replace(/^[:\s]+/, '').trim();
  if (!title) return null;
  const kid = kids.find(k => {
    const n = k.name.toLowerCase();
    return n === name || n.startsWith(name) || name.startsWith(n);
  });
  return kid ? { kid_id: kid.id, kid_name: kid.name, title } : null;
}

function startOfDay(d) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function endOfDay(d)   { const x = new Date(d); x.setHours(23,59,59,999); return x; }

function fmtEventTime(iso, allDay) {
  if (allDay) return 'All day';
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export default function Chores({ kids: allKids, onKidsChange }) {
  const kids = allKids.filter(k => k.role !== 'pet');
  const [chores, setChores] = useState([]);
  const [events, setEvents] = useState([]);
  const [date] = useState(todayStr());
  const [loading, setLoading] = useState(true);
  const [pin, setPin] = useState(() => localStorage.getItem('admin_pin') || null);
  const [pinPrompt, setPinPrompt] = useState(false);
  const pendingAction = useRef(null);
  const [notesChore, setNotesChore] = useState(null);

  function withPin(action) {
    if (pin) return action(pin);
    pendingAction.current = action;
    setPinPrompt(true);
  }

  async function addChore(kid_id, title) {
    const t = title.trim();
    if (!t) return;
    await withPin(async (p) => {
      try {
        await api.createChore(p, { kid_id, title: t });
        await loadAll();
        onKidsChange?.();
      } catch (err) {
        if (/PIN/i.test(err.message)) {
          localStorage.removeItem('admin_pin');
          setPin(null);
          pendingAction.current = (np) => api.createChore(np, { kid_id, title: t })
            .then(() => loadAll()).then(() => onKidsChange?.());
          setPinPrompt(true);
        } else {
          alert(err.message);
        }
      }
    });
  }

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
  // Refresh every 30s so toggles from another device (Pi, other phone)
  // propagate — otherwise a stale FreeTimeCard can stay on screen after
  // a chore is unchecked elsewhere.
  useEffect(() => {
    const id = setInterval(() => loadAll(), 30_000);
    return () => clearInterval(id);
  }, []);

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
    return <div className="p-8 text-slate-500">Loading chores…</div>;
  }

  return (
    <div className="overflow-auto p-3 lg:p-5 lg:h-full">
      <QuickAddBar kids={kids} onAdd={addChore} />
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 lg:h-full">
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
                ${allDone ? 'border-slate-300' : 'border-slate-200'}
                bg-white`}
              style={{ boxShadow: `inset 0 3px 0 0 ${kid.color}` }}>
              {/* Header */}
              <div className="px-4 pt-3 pb-2 flex items-center justify-between"
                style={{ background: `linear-gradient(180deg, ${kid.color}33 0%, transparent 100%)` }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
                    style={{ background: kid.color }}>
                    {kid.initials}
                  </div>
                  <div>
                    <div className="text-lg font-bold leading-tight">{kid.name}</div>
                    <div className="text-[11px] text-slate-500 leading-tight">
                      {total === 0 ? 'No chores today' : `${done}/${total} done${isParent ? '' : ` · ${earnedPoints}/${possiblePoints} pts`}`}
                    </div>
                  </div>
                </div>
                {!isParent && (
                  <div className="text-right">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wide leading-none">Balance</div>
                    <div className="text-2xl font-bold tabular-nums leading-tight">{kid.points_balance}</div>
                  </div>
                )}
              </div>

              {/* Body: either the chore list OR the free-time panel */}
              <div className="flex-1 p-3 overflow-auto">
                {allDone ? (
                  <FreeTimeCard person={kid} events={personalEvents} />
                ) : list.length === 0 ? (
                  <>
                    <PerKidAdd kid={kid} onAdd={addChore} />
                    <div className="text-slate-500 text-center py-6 text-sm">
                      No chores scheduled today
                    </div>
                  </>
                ) : (
                  <div className="space-y-1.5">
                    <PerKidAdd kid={kid} onAdd={addChore} />
                    {list.map(c => (
                      <div
                        key={c.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => toggle(c)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(c); } }}
                        className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl transition tap text-left cursor-pointer
                          ${c.completed
                            ? 'bg-slate-100 text-slate-500 line-through'
                            : 'bg-slate-100 hover:bg-slate-200'}`}
                      >
                        <div className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center flex-shrink-0
                          ${c.completed ? 'border-transparent' : 'border-slate-300'}`}
                          style={c.completed ? { background: kid.color } : {}}>
                          {c.completed && (
                            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="white" strokeWidth="3">
                              <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[15px] font-bold truncate uppercase tracking-wide">{c.title}</div>
                        </div>
                        {c.notes && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setNotesChore(c); }}
                            className="w-7 h-7 rounded-full bg-white border border-slate-300 text-slate-600 flex items-center justify-center text-sm font-bold tap flex-shrink-0"
                            aria-label="View details"
                          >
                            i
                          </button>
                        )}
                        {c.overdue_days > 0 && !c.completed && (
                          <div className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-600 whitespace-nowrap">
                            Overdue {c.overdue_days}d
                          </div>
                        )}
                        {!isParent && c.points > 0 && (
                          <div className="text-xs font-semibold px-2 py-0.5 rounded-md"
                            style={{ background: kid.color + '22', color: c.completed ? '#94a3b8' : kid.color }}>
                            +{c.points}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Laundry-day footer: shows on the kid's assigned weekday
                  regardless of whether they have chores or are all-done. */}
              {kid.laundry_day != null && new Date().getDay() === kid.laundry_day && (
                <div className="px-3 pb-3">
                  <LaundryDayTile color={kid.color} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {pinPrompt && (
        <PinModal
          onVerified={(p) => {
            setPin(p);
            localStorage.setItem('admin_pin', p);
            setPinPrompt(false);
            const fn = pendingAction.current;
            pendingAction.current = null;
            if (fn) fn(p);
          }}
          onCancel={() => { pendingAction.current = null; setPinPrompt(false); }}
        />
      )}
      {notesChore && (
        <ChoreNotesModal
          chore={notesChore}
          color={kids.find(k => k.id === notesChore.kid_id)?.color || '#94a3b8'}
          onClose={() => setNotesChore(null)}
        />
      )}
    </div>
  );
}

function ChoreNotesModal({ chore, color, onClose }) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl p-5 max-w-sm w-full"
        style={{ borderTop: `5px solid ${color}` }}
      >
        <h3 className="text-lg font-bold uppercase tracking-wide mb-3">{chore.title}</h3>
        <p className="text-slate-700 text-base whitespace-pre-line">{chore.notes}</p>
        <button
          onClick={onClose}
          className="mt-5 w-full py-3 rounded-xl bg-slate-100 hover:bg-slate-200 font-semibold tap"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function QuickAddBar({ kids, onAdd }) {
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [hint, setHint] = useState('');

  function submit(e) {
    e.preventDefault();
    const parsed = parseQuickAdd(text, kids);
    if (!parsed) {
      const example = kids[0]?.name || 'Kolt';
      setErr(`Try "${example}: clean room"`);
      return;
    }
    onAdd(parsed.kid_id, parsed.title);
    setHint(`Added "${parsed.title}" for ${parsed.kid_name}`);
    setText('');
    setErr('');
    setTimeout(() => setHint(''), 2500);
  }

  return (
    <form onSubmit={submit} className="lg:hidden mb-3 flex flex-col gap-1">
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => { setText(e.target.value); setErr(''); }}
          placeholder='Quick add — e.g. "Kolt: clean room"'
          className="flex-1 px-3 py-2.5 rounded-xl bg-white border border-slate-300 text-[15px] focus:outline-none focus:border-slate-500"
        />
        <button
          type="submit"
          className="px-4 py-2.5 rounded-xl bg-slate-900 text-white font-semibold tap"
        >
          Add
        </button>
      </div>
      {err   && <div className="text-xs text-rose-600 px-1">{err}</div>}
      {hint  && <div className="text-xs text-emerald-600 px-1">{hint}</div>}
    </form>
  );
}

function PerKidAdd({ kid, onAdd }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');

  function add(t) {
    const v = (t || '').trim();
    if (!v) return;
    onAdd(kid.id, v);
    setTitle('');
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden w-full mb-1.5 px-2.5 py-2 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 text-sm font-semibold tap hover:bg-slate-50"
        style={{ borderColor: kid.color + '55', color: kid.color }}
      >
        + Add chore
      </button>
    );
  }

  return (
    <div className="lg:hidden mb-1.5 p-2 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
      <div className="flex flex-wrap gap-1">
        {FAVORITE_CHORES.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => add(f)}
            className="text-xs px-2 py-1 rounded-full bg-white border border-slate-300 tap"
          >
            + {f}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); add(title); }}
        className="flex gap-1"
      >
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New chore…"
          className="flex-1 px-2 py-2 rounded-lg bg-white border border-slate-300 text-sm focus:outline-none focus:border-slate-500"
        />
        <button
          type="submit"
          className="px-3 py-2 rounded-lg text-white text-sm font-semibold tap"
          style={{ background: kid.color }}
        >
          Add
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setTitle(''); }}
          className="px-2 py-2 rounded-lg bg-slate-200 text-slate-600 text-sm tap"
        >
          ×
        </button>
      </form>
    </div>
  );
}

function LaundryDayTile({ color }) {
  return (
    <div
      className="w-full px-3 py-2 rounded-xl text-center font-bold uppercase tracking-wide text-white text-sm"
      style={{ background: color }}
    >
      🧺 Laundry Day
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
        <div className="text-[11px] text-slate-500 uppercase tracking-wide">
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
            <div key={e.id} className="flex gap-2 items-start bg-slate-50 rounded-md px-2 py-1.5">
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
