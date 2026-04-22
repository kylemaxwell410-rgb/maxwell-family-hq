import { useEffect, useMemo, useState } from 'react';
import { api, todayStr } from '../api.js';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner'];

function weekStart(d = new Date()) {
  const x = new Date(d); x.setHours(0,0,0,0);
  const dow = x.getDay();
  x.setDate(x.getDate() - dow); // Sunday
  return x;
}
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate()+n); return x; }

export default function Meals() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [meals, setMeals] = useState([]);
  const [shopping, setShopping] = useState([]);
  const [newItem, setNewItem] = useState('');
  const [editing, setEditing] = useState(null);

  const days = useMemo(() => {
    const start = addDays(weekStart(), weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [weekOffset]);

  async function loadMeals() {
    const from = todayStr(days[0]);
    const to   = todayStr(days[6]);
    setMeals(await api.meals(from, to));
  }
  async function loadShopping() {
    setShopping(await api.shopping());
  }
  useEffect(() => { loadMeals(); }, [days[0]]);
  useEffect(() => { loadShopping(); }, []);

  const mealMap = useMemo(() => {
    const m = {};
    for (const it of meals) m[`${it.meal_date}|${it.meal_type}`] = it;
    return m;
  }, [meals]);

  async function saveMeal(date, type, description) {
    await api.upsertMeal({ meal_date: date, meal_type: type, description });
    await loadMeals();
  }

  async function addItem() {
    if (!newItem.trim()) return;
    await api.addShopping({ item: newItem.trim() });
    setNewItem('');
    await loadShopping();
  }
  async function toggleItem(it) {
    await api.patchShopping(it.id, { checked: !it.checked });
    await loadShopping();
  }
  async function deleteItem(id) {
    await api.deleteShopping(id);
    await loadShopping();
  }
  async function clearDone() {
    await api.clearChecked();
    await loadShopping();
  }

  return (
    <div className="h-full flex gap-4 p-6 overflow-hidden">
      <section className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold">Weekly meals</h2>
          <div className="flex gap-2">
            <button onClick={() => setWeekOffset(w => w - 1)}
              className="px-4 py-2 bg-white/5 rounded-lg tap">←</button>
            <button onClick={() => setWeekOffset(0)}
              className="px-4 py-2 bg-white/5 rounded-lg tap text-sm">This week</button>
            <button onClick={() => setWeekOffset(w => w + 1)}
              className="px-4 py-2 bg-white/5 rounded-lg tap">→</button>
          </div>
        </div>
        <div className="flex-1 grid grid-cols-8 gap-1 overflow-auto bg-[#111923] border border-white/5 rounded-2xl p-2">
          <div></div>
          {days.map(d => (
            <div key={d.toISOString()} className="text-center py-2">
              <div className="text-xs uppercase text-slate-400 font-semibold">
                {d.toLocaleDateString(undefined, { weekday: 'short' })}
              </div>
              <div className="text-base font-bold">{d.getDate()}</div>
            </div>
          ))}
          {MEAL_TYPES.map(type => (
            <div key={type} className="contents">
              <div className="flex items-center justify-end pr-3 text-sm font-semibold text-slate-400 capitalize">
                {type}
              </div>
              {days.map(d => {
                const date = todayStr(d);
                const key = `${date}|${type}`;
                const entry = mealMap[key];
                return (
                  <button
                    key={key}
                    onClick={() => setEditing({ date, type, description: entry?.description || '' })}
                    className="min-h-[88px] rounded-lg p-2 text-sm bg-white/5 hover:bg-white/10 tap text-left"
                  >
                    <div className="text-slate-200 line-clamp-3">
                      {entry?.description || <span className="text-slate-500">—</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </section>

      <aside className="w-[360px] flex flex-col bg-[#111923] border border-white/5 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/5">
          <h2 className="text-xl font-bold mb-3">Shopping list</h2>
          <div className="flex gap-2">
            <input
              value={newItem}
              onChange={e => setNewItem(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addItem()}
              placeholder="Add item…"
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm"
            />
            <button onClick={addItem}
              className="px-4 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-semibold tap">+</button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-2">
          {shopping.length === 0 && (
            <div className="text-slate-500 text-center py-8 text-sm">List is empty</div>
          )}
          {shopping.map(it => (
            <div key={it.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5">
              <button onClick={() => toggleItem(it)}
                className={`w-9 h-9 rounded-md border-2 flex items-center justify-center flex-shrink-0 tap
                  ${it.checked ? 'bg-emerald-600 border-emerald-600' : 'border-white/20'}`}>
                {it.checked && <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="white" strokeWidth="3"><path d="M5 12l5 5L20 7"/></svg>}
              </button>
              <div className={`flex-1 text-sm ${it.checked ? 'text-slate-500 line-through' : ''}`}>{it.item}</div>
              <button onClick={() => deleteItem(it.id)}
                className="w-9 h-9 rounded-md hover:bg-white/10 text-slate-500 tap">×</button>
            </div>
          ))}
        </div>
        {shopping.some(s => s.checked) && (
          <div className="p-3 border-t border-white/5">
            <button onClick={clearDone}
              className="w-full py-2 text-sm bg-white/5 hover:bg-white/10 rounded-lg tap">
              Clear checked
            </button>
          </div>
        )}
      </aside>

      {editing && (
        <MealEditModal editing={editing} onSave={async (desc) => {
          await saveMeal(editing.date, editing.type, desc);
          setEditing(null);
        }} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function MealEditModal({ editing, onSave, onClose }) {
  const [val, setVal] = useState(editing.description || '');
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#111923] border border-white/10 rounded-2xl p-6 w-[480px]">
        <h3 className="text-lg font-bold mb-1 capitalize">{editing.type}</h3>
        <p className="text-sm text-slate-400 mb-4">{editing.date}</p>
        <textarea
          value={val}
          onChange={e => setVal(e.target.value)}
          placeholder="What's on the menu?"
          className="w-full min-h-[120px] bg-white/5 border border-white/10 rounded-lg px-3 py-2"
        />
        <div className="flex gap-2 mt-4">
          <button onClick={() => onSave(val)}
            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-semibold tap">Save</button>
          <button onClick={onClose}
            className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-semibold tap">Cancel</button>
        </div>
      </div>
    </div>
  );
}
