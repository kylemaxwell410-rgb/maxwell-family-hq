import { useEffect, useMemo, useState } from 'react';
import { api, todayStr } from '../api.js';

const VIEWS = [
  { id: 'today',    label: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'week',     label: 'Week' },
];

function startOfDay(d) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d)   { const x = new Date(d); x.setHours(23,59,59,999); return x; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate()+n); return x; }
function sameDay(a, b) { return startOfDay(a).getTime() === startOfDay(b).getTime(); }

function fmtTime(iso, allDay) {
  if (allDay) return 'All day';
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function dayLabel(date) {
  const today = startOfDay(new Date());
  const d = startOfDay(date);
  const diff = Math.round((d - today) / 86400000);
  if (diff === 0) return 'TODAY';
  if (diff === 1) return 'TOMORROW';
  return date.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
}

function dateSubtitle(date) {
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

export default function Calendar({ kids }) {
  const [view, setView] = useState('today');
  const [events, setEvents] = useState([]);
  const [filterKid, setFilterKid] = useState(null); // null = everyone
  const [editing, setEditing] = useState(null);

  const kidMap = useMemo(() => Object.fromEntries(kids.map(k => [k.id, k])), [kids]);

  const range = useMemo(() => {
    const today = startOfDay(new Date());
    if (view === 'today')    return [today, endOfDay(today)];
    if (view === 'tomorrow') return [addDays(today, 1), endOfDay(addDays(today, 1))];
    return [today, endOfDay(addDays(today, 6))];
  }, [view]);

  async function load() {
    const [from, to] = range;
    setEvents(await api.events(from.toISOString(), to.toISOString()));
  }
  useEffect(() => { load(); }, [view]);

  async function save(e) {
    if (!e.title || !e.start_datetime) return;
    if (e.id) await api.updateEvent(e.id, e);
    else await api.createEvent(e);
    setEditing(null);
    await load();
  }
  async function remove(id) {
    await api.deleteEvent(id);
    setEditing(null);
    await load();
  }

  const visibleEvents = useMemo(() => {
    if (!filterKid) return events;
    // Show this person's events + untagged "family" events.
    return events.filter(e => e.kid_id === filterKid || !e.kid_id);
  }, [events, filterKid]);

  // Build a list of days in range, each with its events.
  const days = useMemo(() => {
    const [from, to] = range;
    const out = [];
    let d = startOfDay(from);
    const last = startOfDay(to);
    while (d <= last) {
      const cur = new Date(d);
      const todaysEvents = visibleEvents
        .filter(e => sameDay(new Date(e.start_datetime), cur))
        .sort((a, b) => {
          if (a.all_day && !b.all_day) return -1;
          if (!a.all_day && b.all_day) return 1;
          return new Date(a.start_datetime) - new Date(b.start_datetime);
        });
      out.push({ date: cur, events: todaysEvents });
      d = addDays(d, 1);
    }
    return out;
  }, [range, visibleEvents]);

  return (
    <div className="h-full flex flex-col p-6 gap-5 overflow-hidden">
      {/* Top: view switcher + family avatar filter */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-2">
          {VIEWS.map(v => (
            <button key={v.id} onClick={() => setView(v.id)}
              className={`px-5 py-3 rounded-xl text-base font-semibold tap
                ${view === v.id ? 'bg-slate-200 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
              {v.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterKid(null)}
            className={`px-4 py-2 rounded-full text-sm font-semibold tap transition
              ${filterKid === null ? 'bg-slate-200 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
            Everyone
          </button>
          {kids.map(k => {
            const on = filterKid === k.id;
            return (
              <button key={k.id} onClick={() => setFilterKid(on ? null : k.id)}
                className="group flex items-center gap-2 tap"
                title={k.name}>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-base font-bold border-2 transition text-white
                  ${on ? 'scale-110' : 'opacity-60 hover:opacity-100'}`}
                  style={{
                    background: k.color,
                    borderColor: on ? '#0f172a' : 'transparent',
                  }}>
                  {k.initials}
                </div>
              </button>
            );
          })}
        </div>

        <button onClick={() => setEditing({
          title: '', start_datetime: new Date().toISOString().slice(0,16),
          end_datetime: '', kid_id: '', notes: '', all_day: false,
        })}
          className="px-6 py-3 bg-slate-200 hover:bg-white/15 rounded-xl font-semibold tap">
          + New event
        </button>
      </div>

      {/* Agenda */}
      <div className="flex-1 overflow-auto pr-1">
        {days.every(d => d.events.length === 0) && (
          <div className="text-slate-500 text-center py-20 text-lg">
            {filterKid ? `Nothing on ${kidMap[filterKid]?.name}'s calendar` : 'No events'}
          </div>
        )}

        <div className="space-y-6">
          {days.filter(d => view !== 'week' || d.events.length > 0).map(d => (
            <DaySection
              key={d.date.toISOString()}
              date={d.date}
              events={d.events}
              kidMap={kidMap}
              onEdit={setEditing}
            />
          ))}
        </div>
      </div>

      {editing && (
        <EventModal
          event={editing}
          kids={kids}
          onSave={save}
          onDelete={editing.id ? () => remove(editing.id) : null}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function DaySection({ date, events, kidMap, onEdit }) {
  const isToday = sameDay(date, new Date());
  return (
    <section>
      <div className="flex items-baseline gap-3 mb-3 pb-2 border-b border-slate-300">
        <h2 className={`text-2xl font-extrabold tracking-tight ${isToday ? 'text-white' : 'text-slate-700'}`}>
          {dayLabel(date)}
        </h2>
        <span className="text-slate-500 text-sm">{dateSubtitle(date)}</span>
        <span className="ml-auto text-xs text-slate-500">
          {events.length} {events.length === 1 ? 'event' : 'events'}
        </span>
      </div>

      {events.length === 0 ? (
        <div className="text-slate-600 text-sm italic px-1">Nothing scheduled</div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {events.map(e => (
            <EventCard key={e.id} event={e} kid={e.kid_id ? kidMap[e.kid_id] : null} onEdit={onEdit} />
          ))}
        </div>
      )}
    </section>
  );
}

function EventCard({ event, kid, onEdit }) {
  const stripe = kid ? kid.color : '#334155';
  const bg     = kid ? kid.color + '1a' : '#1e293b33';
  return (
    <button
      onClick={() => onEdit(event)}
      className="group text-left flex gap-3 rounded-2xl border border-slate-200 p-4 tap hover:border-slate-300 transition"
      style={{ background: bg }}
    >
      <div className="w-1.5 self-stretch rounded-full" style={{ background: stripe }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-0.5">
          <div className="text-lg font-semibold truncate">{event.title}</div>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-700">
          <span className="tabular-nums font-medium">{fmtTime(event.start_datetime, event.all_day)}</span>
          {kid && (
            <>
              <span className="text-slate-600">·</span>
              <span className="font-medium" style={{ color: kid.color }}>{kid.name}</span>
            </>
          )}
        </div>
        {event.notes && (
          <div className="text-xs text-slate-500 mt-1.5 line-clamp-2">{event.notes}</div>
        )}
      </div>
    </button>
  );
}

function EventModal({ event, kids, onSave, onDelete, onClose }) {
  const [form, setForm] = useState({
    ...event,
    start_datetime: event.start_datetime ? toLocal(event.start_datetime) : '',
    end_datetime: event.end_datetime ? toLocal(event.end_datetime) : '',
  });

  function toLocal(iso) {
    const d = new Date(iso);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function submit() {
    const payload = {
      ...form,
      start_datetime: form.start_datetime ? new Date(form.start_datetime).toISOString() : null,
      end_datetime: form.end_datetime ? new Date(form.end_datetime).toISOString() : null,
      kid_id: form.kid_id || null,
    };
    onSave(payload);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white border border-slate-300 rounded-2xl p-6 w-[560px] max-h-[90vh] overflow-auto">
        <h3 className="text-xl font-bold mb-4">{event.id ? 'Edit event' : 'New event'}</h3>
        <div className="space-y-3">
          <Field label="Title">
            <input className="input" value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start">
              <input type="datetime-local" className="input" value={form.start_datetime}
                onChange={e => setForm({ ...form, start_datetime: e.target.value })} />
            </Field>
            <Field label="End (optional)">
              <input type="datetime-local" className="input" value={form.end_datetime}
                onChange={e => setForm({ ...form, end_datetime: e.target.value })} />
            </Field>
          </div>

          <Field label="Who">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, kid_id: '' })}
                className={`px-4 py-2 rounded-full text-sm font-semibold tap border
                  ${!form.kid_id ? 'bg-white/15 border-slate-400 text-white' : 'border-slate-300 text-slate-500 hover:bg-slate-100'}`}>
                Family
              </button>
              {kids.map(k => {
                const on = form.kid_id === k.id;
                return (
                  <button key={k.id} type="button"
                    onClick={() => setForm({ ...form, kid_id: k.id })}
                    className={`px-4 py-2 rounded-full text-sm font-semibold tap border transition
                      ${on ? 'text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                    style={on ? { background: k.color + '22', borderColor: k.color } : { borderColor: '#e5e7eb' }}>
                    {k.name}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Notes">
            <textarea className="input min-h-[80px]" value={form.notes || ''}
              onChange={e => setForm({ ...form, notes: e.target.value })} />
          </Field>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!form.all_day}
              onChange={e => setForm({ ...form, all_day: e.target.checked })} />
            All day
          </label>
        </div>
        <div className="flex gap-2 mt-6">
          <button onClick={submit}
            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-semibold tap">Save</button>
          {onDelete && (
            <button onClick={onDelete}
              className="px-6 py-3 bg-rose-600 hover:bg-rose-600 rounded-xl font-semibold tap">Delete</button>
          )}
          <button onClick={onClose}
            className="px-6 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl font-semibold tap">Cancel</button>
        </div>
      </div>
      <style>{`.input{width:100%;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;padding:10px 12px;color:#0f172a;font-size:15px;min-height:44px}`}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">{label}</label>
      {children}
    </div>
  );
}
