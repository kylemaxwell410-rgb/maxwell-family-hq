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

function fmtTime(iso, allDay) {
  if (allDay) return 'All day';
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
function fmtDay(iso) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function Calendar({ kids }) {
  const [view, setView] = useState('today');
  const [events, setEvents] = useState([]);
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

  const grouped = useMemo(() => {
    const g = {};
    for (const e of events) {
      const key = todayStr(new Date(e.start_datetime));
      (g[key] ||= []).push(e);
    }
    return g;
  }, [events]);

  return (
    <div className="h-full flex flex-col p-6 gap-4 overflow-hidden">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {VIEWS.map(v => (
            <button key={v.id} onClick={() => setView(v.id)}
              className={`px-5 py-3 rounded-xl text-base font-semibold tap
                ${view === v.id ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5'}`}>
              {v.label}
            </button>
          ))}
        </div>
        <button onClick={() => setEditing({
          title: '', start_datetime: new Date().toISOString().slice(0,16),
          end_datetime: '', kid_id: '', notes: '', all_day: false,
        })}
          className="px-6 py-3 bg-white/10 hover:bg-white/15 rounded-xl font-semibold tap">
          + New event
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {Object.keys(grouped).length === 0 && (
          <div className="text-slate-500 text-center py-20 text-lg">No events</div>
        )}
        {Object.entries(grouped).map(([day, items]) => (
          <div key={day} className="mb-6">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">
              {fmtDay(day)}
            </h3>
            <div className="space-y-2">
              {items.map(e => {
                const kid = e.kid_id ? kidMap[e.kid_id] : null;
                return (
                  <button
                    key={e.id}
                    onClick={() => setEditing(e)}
                    className="w-full flex items-center gap-4 bg-[#111923] border border-white/5 rounded-xl p-4 hover:bg-white/5 tap text-left"
                  >
                    <div className="w-2 h-14 rounded-full" style={{ background: kid ? kid.color : '#334155' }} />
                    <div className="w-32 text-sm text-slate-400 tabular-nums">
                      {fmtTime(e.start_datetime, e.all_day)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-lg font-semibold truncate">{e.title}</div>
                      {e.notes && <div className="text-sm text-slate-400 truncate">{e.notes}</div>}
                    </div>
                    {kid && (
                      <span className="px-3 py-1 rounded-full text-xs font-bold"
                        style={{ background: kid.color + '33', color: kid.color }}>
                        {kid.name}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#111923] border border-white/10 rounded-2xl p-6 w-[540px] max-h-[90vh] overflow-auto">
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
          <Field label="Kid (optional)">
            <select className="input" value={form.kid_id || ''}
              onChange={e => setForm({ ...form, kid_id: e.target.value })}>
              <option value="">— Family —</option>
              {kids.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
            </select>
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
              className="px-6 py-3 bg-rose-700 hover:bg-rose-600 rounded-xl font-semibold tap">Delete</button>
          )}
          <button onClick={onClose}
            className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-semibold tap">Cancel</button>
        </div>
      </div>
      <style>{`.input{width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:10px 12px;color:#e6edf3;font-size:15px;min-height:44px}`}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">{label}</label>
      {children}
    </div>
  );
}
