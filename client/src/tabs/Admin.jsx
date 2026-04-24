import { useEffect, useState } from 'react';
import PinModal from '../components/PinModal.jsx';
import { api } from '../api.js';

const DOW = ['S','M','T','W','T','F','S'];

export default function Admin({ kids, onKidsChange }) {
  const [pin, setPin] = useState(null);
  const [chores, setChores] = useState([]);
  const [section, setSection] = useState('chores'); // chores | kids | points
  const [editing, setEditing] = useState(null);
  const [adjust, setAdjust] = useState(null);

  async function loadChores() {
    if (!pin) return;
    setChores(await api.adminChores(pin));
  }
  useEffect(() => { loadChores(); }, [pin]);

  if (!pin) return <PinModal onVerified={setPin} onCancel={() => setPin(null)} />;

  async function saveChore(c) {
    if (c.id) {
      await api.updateChore(pin, c.id, c);
    } else {
      await api.createChore(pin, c);
    }
    setEditing(null);
    await loadChores();
  }
  async function deleteChore(id) {
    if (!confirm('Delete this chore?')) return;
    await api.deleteChore(pin, id);
    setEditing(null);
    await loadChores();
  }
  async function saveKid(k) {
    await api.updateKid(pin, k.id, k);
    setEditing(null);
    await onKidsChange();
  }
  async function submitAdjust() {
    if (!adjust.kid_id || !adjust.amount) return;
    await api.adjust(adjust.kid_id, Number(adjust.amount), adjust.reason || 'Manual adjustment');
    setAdjust(null);
    await onKidsChange();
  }

  return (
    <div className="h-full flex gap-4 p-6 overflow-hidden">
      <nav className="w-52 flex flex-col gap-1">
        {['chores','kids','points'].map(s => (
          <button key={s} onClick={() => setSection(s)}
            className={`px-4 py-3 rounded-xl font-semibold capitalize text-left tap
              ${section === s ? 'bg-white/10' : 'hover:bg-white/5 text-slate-400'}`}>
            {s}
          </button>
        ))}
        <button onClick={() => setPin(null)}
          className="mt-auto px-4 py-3 rounded-xl font-semibold text-left text-rose-400 hover:bg-white/5 tap">
          Lock
        </button>
      </nav>

      <section className="flex-1 bg-[#111923] border border-white/5 rounded-2xl overflow-hidden flex flex-col">
        {section === 'chores' && (
          <>
            <div className="p-4 border-b border-white/5 flex justify-between items-center">
              <h2 className="text-xl font-bold">All chores</h2>
              <button onClick={() => setEditing({
                _type: 'chore', kid_id: kids[0]?.id || '', title: '', points: 1,
                frequency: 'daily', days_of_week: '0,1,2,3,4,5,6', active: 1, sort_order: 0,
              })}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-semibold tap">
                + New chore
              </button>
            </div>
            <div className="flex-1 overflow-auto divide-y divide-white/5">
              {chores.map(c => (
                <button key={c.id} onClick={() => setEditing({ _type:'chore', ...c })}
                  className="w-full flex items-center gap-3 p-3 hover:bg-white/5 tap text-left">
                  <div className="w-2 h-10 rounded-full" style={{ background: c.kid_color }} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{c.title}</div>
                    <div className="text-xs text-slate-400">{c.kid_name} · {c.active ? 'Active' : 'Inactive'} · {daysLabel(c.days_of_week)}</div>
                  </div>
                  <div className="font-bold text-lg tabular-nums">+{c.points}</div>
                </button>
              ))}
            </div>
          </>
        )}

        {section === 'kids' && (
          <>
            <div className="p-4 border-b border-white/5"><h2 className="text-xl font-bold">Family</h2></div>
            <div className="p-4 grid grid-cols-3 gap-3 overflow-auto">
              {kids.map(k => (
                <button key={k.id} onClick={() => setEditing({ _type:'kid', ...k })}
                  className="p-4 rounded-xl hover:bg-white/5 tap text-left border border-white/5"
                  style={{ background: k.color + '22' }}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold" style={{ background: k.color }}>{k.initials}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold truncate">{k.name}</div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">
                        {k.role === 'parent' ? 'Parent' : 'Kid'}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-slate-400">{k.color} · order {k.sort_order}</div>
                </button>
              ))}
            </div>
          </>
        )}

        {section === 'points' && (
          <>
            <div className="p-4 border-b border-white/5 flex justify-between items-center">
              <h2 className="text-xl font-bold">Manual adjustment</h2>
              <button onClick={() => {
                const first = kids.find(k => k.role !== 'parent');
                setAdjust({ kid_id: first?.id || '', amount: '', reason: '' });
              }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-semibold tap">
                + Adjust
              </button>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              {kids.filter(k => k.role !== 'parent').map(k => (
                <div key={k.id} className="p-4 rounded-xl border border-white/5" style={{ background: k.color + '22' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold" style={{ background: k.color }}>{k.initials}</div>
                    <div>
                      <div className="font-bold">{k.name}</div>
                      <div className="text-2xl font-extrabold tabular-nums">{k.points_balance}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {editing?._type === 'chore' && (
        <ChoreModal chore={editing} kids={kids} onSave={saveChore}
          onDelete={editing.id ? () => deleteChore(editing.id) : null}
          onClose={() => setEditing(null)} />
      )}
      {editing?._type === 'kid' && (
        <KidModal kid={editing} onSave={saveKid} onClose={() => setEditing(null)} />
      )}
      {adjust && (
        <AdjustModal kids={kids} adjust={adjust} setAdjust={setAdjust}
          onSubmit={submitAdjust} onClose={() => setAdjust(null)} />
      )}
    </div>
  );
}

function daysLabel(dow) {
  const set = new Set(dow.split(',').map(Number));
  if (set.size === 7) return 'Every day';
  return DOW.map((d, i) => set.has(i) ? d : '·').join(' ');
}

function ChoreModal({ chore, kids, onSave, onDelete, onClose }) {
  const [f, setF] = useState({
    kid_id: chore.kid_id, title: chore.title, points: chore.points,
    frequency: chore.frequency || 'daily',
    days_of_week: chore.days_of_week || '0,1,2,3,4,5,6',
    active: chore.active ?? 1, sort_order: chore.sort_order ?? 0,
  });
  const daySet = new Set(f.days_of_week.split(',').filter(Boolean).map(Number));
  function toggleDay(i) {
    if (daySet.has(i)) daySet.delete(i); else daySet.add(i);
    setF({ ...f, days_of_week: [...daySet].sort((a,b)=>a-b).join(',') });
  }
  return (
    <Modal>
      <h3 className="text-xl font-bold mb-4">{chore.id ? 'Edit chore' : 'New chore'}</h3>
      <div className="space-y-3">
        <FieldRow label="Kid">
          <select className="input" value={f.kid_id} onChange={e => setF({ ...f, kid_id: e.target.value })}>
            {kids.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
          </select>
        </FieldRow>
        <FieldRow label="Title">
          <input className="input" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} />
        </FieldRow>
        <div className="grid grid-cols-2 gap-3">
          <FieldRow label="Points">
            <input type="number" className="input" value={f.points}
              onChange={e => setF({ ...f, points: Number(e.target.value) })} />
          </FieldRow>
          <FieldRow label="Sort order">
            <input type="number" className="input" value={f.sort_order}
              onChange={e => setF({ ...f, sort_order: Number(e.target.value) })} />
          </FieldRow>
        </div>
        <FieldRow label="Days of week">
          <div className="flex gap-1">
            {DOW.map((d, i) => (
              <button key={i} onClick={() => toggleDay(i)}
                className={`w-11 h-11 rounded-lg font-bold tap
                  ${daySet.has(i) ? 'bg-emerald-600' : 'bg-white/5 hover:bg-white/10'}`}>{d}</button>
            ))}
          </div>
        </FieldRow>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!f.active} onChange={e => setF({ ...f, active: e.target.checked ? 1 : 0 })} />
          Active
        </label>
      </div>
      <div className="flex gap-2 mt-6">
        <button onClick={() => onSave({ ...chore, ...f })}
          className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-semibold tap">Save</button>
        {onDelete && (
          <button onClick={onDelete}
            className="px-6 py-3 bg-rose-700 hover:bg-rose-600 rounded-xl font-semibold tap">Delete</button>
        )}
        <button onClick={onClose}
          className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-semibold tap">Cancel</button>
      </div>
    </Modal>
  );
}

function KidModal({ kid, onSave, onClose }) {
  const [f, setF] = useState({
    name: kid.name,
    initials: kid.initials,
    color: kid.color,
    sort_order: kid.sort_order,
    role: kid.role || 'kid',
  });
  return (
    <Modal>
      <h3 className="text-xl font-bold mb-4">Edit {f.role === 'parent' ? 'parent' : 'kid'}</h3>
      <div className="space-y-3">
        <FieldRow label="Name"><input className="input" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></FieldRow>
        <FieldRow label="Initials"><input className="input" value={f.initials} onChange={e => setF({ ...f, initials: e.target.value })} /></FieldRow>
        <FieldRow label="Role">
          <div className="flex gap-2">
            {['kid','parent'].map(r => (
              <button key={r} type="button"
                onClick={() => setF({ ...f, role: r })}
                className={`flex-1 py-2 rounded-lg capitalize tap border
                  ${f.role === r ? 'bg-white/10 border-white/25 text-white' : 'border-white/10 text-slate-400 hover:bg-white/5'}`}>
                {r}
              </button>
            ))}
          </div>
        </FieldRow>
        <FieldRow label="Color (hex)">
          <div className="flex gap-2">
            <input type="color" value={f.color} onChange={e => setF({ ...f, color: e.target.value })}
              className="h-11 w-16 bg-transparent border border-white/10 rounded-lg" />
            <input className="input flex-1" value={f.color} onChange={e => setF({ ...f, color: e.target.value })} />
          </div>
        </FieldRow>
        <FieldRow label="Sort order">
          <input type="number" className="input" value={f.sort_order}
            onChange={e => setF({ ...f, sort_order: Number(e.target.value) })} />
        </FieldRow>
      </div>
      <div className="flex gap-2 mt-6">
        <button onClick={() => onSave({ ...kid, ...f })}
          className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-semibold tap">Save</button>
        <button onClick={onClose}
          className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-semibold tap">Cancel</button>
      </div>
    </Modal>
  );
}

function AdjustModal({ kids, adjust, setAdjust, onSubmit, onClose }) {
  return (
    <Modal>
      <h3 className="text-xl font-bold mb-4">Point adjustment</h3>
      <div className="space-y-3">
        <FieldRow label="Kid">
          <select className="input" value={adjust.kid_id}
            onChange={e => setAdjust({ ...adjust, kid_id: e.target.value })}>
            {kids.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
          </select>
        </FieldRow>
        <FieldRow label="Amount (+/-)">
          <input type="number" className="input" value={adjust.amount}
            onChange={e => setAdjust({ ...adjust, amount: e.target.value })} />
        </FieldRow>
        <FieldRow label="Reason">
          <input className="input" value={adjust.reason}
            onChange={e => setAdjust({ ...adjust, reason: e.target.value })} />
        </FieldRow>
      </div>
      <div className="flex gap-2 mt-6">
        <button onClick={onSubmit}
          className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-semibold tap">Apply</button>
        <button onClick={onClose}
          className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-semibold tap">Cancel</button>
      </div>
    </Modal>
  );
}

function Modal({ children }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#111923] border border-white/10 rounded-2xl p-6 w-[520px] max-h-[90vh] overflow-auto">
        {children}
      </div>
      <style>{`.input{width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:10px 12px;color:#e6edf3;font-size:15px;min-height:44px}`}</style>
    </div>
  );
}

function FieldRow({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">{label}</label>
      {children}
    </div>
  );
}
