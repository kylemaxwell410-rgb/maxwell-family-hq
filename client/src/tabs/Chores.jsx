import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import { api, todayStr } from '../api.js';
import PinModal from '../components/PinModal.jsx';
import EditModeButton from '../components/EditModeButton.jsx';
import QuickAddBar from '../components/QuickAddBar.jsx';
import { useEditMode } from '../hooks/useEditMode.js';

const FAVORITE_CHORES = ['Make bed', 'Homework', 'Tidy room', 'Feed pets'];

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

  const editMode = useEditMode();
  const [activeDragChore, setActiveDragChore] = useState(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );

  function handleDragStart(event) {
    const id = event.active.id;
    setActiveDragChore(chores.find(c => c.id === id) || null);
  }

  async function handleDragEnd(event) {
    setActiveDragChore(null);
    const { active, over } = event;
    if (!over) return;
    const choreId = String(active.id);
    const targetKidId = String(over.id);
    const chore = chores.find(c => c.id === choreId);
    if (!chore || chore.kid_id === targetKidId) return;
    if (!editMode.pin) return;
    try {
      await api.setChoreOverride(editMode.pin, choreId, date, targetKidId);
      await loadAll();
    } catch (err) {
      alert('Could not move chore: ' + err.message);
    }
  }

  async function skipChoreToday(chore) {
    if (!editMode.pin) return;
    if (!confirm(`Remove "${chore.title}" from today's list?\n\nIt will come back tomorrow on its normal schedule.`)) return;
    try {
      await api.skipChore(editMode.pin, chore.id, date);
      await loadAll();
    } catch (err) {
      alert('Could not skip chore: ' + err.message);
    }
  }

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
      <div className="flex items-start gap-2 mb-3 lg:hidden">
        <div className="flex-1 min-w-0">
          <QuickAddBar kids={kids} onAdd={addChore} />
        </div>
        <EditModeButton
          unlocked={editMode.unlocked}
          secondsLeft={editMode.secondsLeft}
          onUnlock={editMode.unlock}
          onLock={editMode.lock}
        />
      </div>
      <div className="hidden lg:flex justify-end mb-2">
        <EditModeButton
          unlocked={editMode.unlocked}
          secondsLeft={editMode.secondsLeft}
          onUnlock={editMode.unlock}
          onLock={editMode.lock}
        />
      </div>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 lg:h-full">
          {kids.map(kid => {
            const list = byKid[kid.id] || [];
            const personalEvents = [
              ...(eventsByPerson[kid.id] || []),
              ...eventsByPerson._family,
            ].sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime));
            return (
              <KidColumn
                key={kid.id}
                kid={kid}
                list={list}
                personalEvents={personalEvents}
                editMode={editMode}
                onAddChore={addChore}
                onToggle={toggle}
                onShowNotes={setNotesChore}
                onSkipToday={skipChoreToday}
              />
            );
          })}
        </div>
        <DragOverlay>
          {activeDragChore ? (
            <div className="px-2.5 py-2 rounded-xl bg-white border-2 border-emerald-500 shadow-xl text-[15px] font-bold uppercase tracking-wide max-w-[260px] truncate">
              {activeDragChore.title}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
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

function KidColumn({ kid, list, personalEvents, editMode, onAddChore, onToggle, onShowNotes, onSkipToday }) {
  const { setNodeRef, isOver } = useDroppable({ id: kid.id });
  const done  = list.filter(c => c.completed).length;
  const total = list.length;
  const earnedPoints   = list.filter(c => c.completed).reduce((s, c) => s + c.points, 0);
  const possiblePoints = list.reduce((s, c) => s + c.points, 0);
  const allDone = total > 0 && done === total;
  const isParent = kid.role === 'parent';

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-2xl border overflow-hidden transition
        ${allDone ? 'border-slate-300' : 'border-slate-200'}
        ${editMode.unlocked && isOver ? 'ring-4 ring-emerald-400' : ''}
        bg-white`}
      style={{ boxShadow: `inset 0 3px 0 0 ${kid.color}` }}
    >
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

      <div className="flex-1 p-3 overflow-auto">
        {allDone ? (
          <FreeTimeCard person={kid} events={personalEvents} />
        ) : list.length === 0 ? (
          <>
            <PerKidAdd kid={kid} onAdd={onAddChore} />
            <div className="text-slate-500 text-center py-6 text-sm">
              No chores scheduled today
            </div>
          </>
        ) : (
          <div className="space-y-1.5">
            <PerKidAdd kid={kid} onAdd={onAddChore} />
            {list.map(c => (
              <ChoreItem
                key={c.id}
                chore={c}
                kid={kid}
                isParent={isParent}
                editMode={editMode}
                onToggle={onToggle}
                onShowNotes={onShowNotes}
                onSkipToday={onSkipToday}
              />
            ))}
          </div>
        )}
      </div>
      {kid.laundry_day != null && new Date().getDay() === kid.laundry_day && (
        <div className="px-3 pb-3 flex-shrink-0">
          <LaundryDayTile color={kid.color} />
        </div>
      )}
    </div>
  );
}

function ChoreItem({ chore, kid, isParent, editMode, onToggle, onShowNotes, onSkipToday }) {
  const draggable = editMode.unlocked;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: chore.id,
    disabled: !draggable,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: isDragging ? 0.4 : 1, touchAction: 'none' }
    : { touchAction: draggable ? 'none' : undefined };

  function handleClick(e) {
    if (draggable) return; // dragging interferes — don't toggle in edit mode
    onToggle(chore);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !draggable) { e.preventDefault(); onToggle(chore); } }}
      {...(draggable ? { ...listeners, ...attributes } : {})}
      className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl transition tap text-left cursor-pointer
        ${draggable ? 'ring-2 ring-emerald-400/60' : ''}
        ${chore.completed
          ? 'bg-slate-100 text-slate-500 line-through'
          : 'bg-slate-100 hover:bg-slate-200'}`}
    >
      <div className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center flex-shrink-0
        ${chore.completed ? 'border-transparent' : 'border-slate-300'}`}
        style={chore.completed ? { background: kid.color } : {}}>
        {chore.completed && (
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="white" strokeWidth="3">
            <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-bold truncate uppercase tracking-wide">{chore.title}</div>
        {chore.is_overridden && (
          <div className="text-[9px] text-emerald-700 font-semibold uppercase tracking-wider">moved today</div>
        )}
      </div>
      {chore.notes && !draggable && (
        <button
          onClick={(e) => { e.stopPropagation(); onShowNotes(chore); }}
          className="w-7 h-7 rounded-full bg-white border border-slate-300 text-slate-600 flex items-center justify-center text-sm font-bold tap flex-shrink-0"
          aria-label="View details"
        >
          i
        </button>
      )}
      {draggable && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onSkipToday(chore); }}
          className="w-7 h-7 rounded-full bg-rose-100 hover:bg-rose-200 text-rose-700 flex items-center justify-center text-sm font-bold tap flex-shrink-0"
          aria-label="Skip for today"
          title="Remove from today's list (returns tomorrow)"
        >
          ×
        </button>
      )}
      {chore.overdue_days > 0 && !chore.completed && (
        <div className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-600 whitespace-nowrap">
          Overdue {chore.overdue_days}d
        </div>
      )}
      {!isParent && chore.points > 0 && (
        <div className="text-xs font-semibold px-2 py-0.5 rounded-md"
          style={{ background: kid.color + '22', color: chore.completed ? '#94a3b8' : kid.color }}>
          +{chore.points}
        </div>
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
      className="w-full px-3 py-3 rounded-xl text-center font-bold uppercase tracking-wide text-white text-base"
      style={{ background: color }}
    >
      <span className="emoji mr-1">🧺</span>Laundry Day
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
