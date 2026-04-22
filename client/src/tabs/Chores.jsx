import { useEffect, useMemo, useState } from 'react';
import { api, todayStr } from '../api.js';

export default function Chores({ kids, onKidsChange }) {
  const [chores, setChores] = useState([]);
  const [date] = useState(todayStr());
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setChores(await api.chores(date));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [date]);

  async function toggle(chore) {
    if (chore.completed) {
      await api.uncompleteChore(chore.id, date);
    } else {
      await api.completeChore(chore.id, date);
    }
    await load();
    onKidsChange?.();
  }

  const byKid = useMemo(() => {
    const map = {};
    for (const k of kids) map[k.id] = [];
    for (const c of chores) (map[c.kid_id] ||= []).push(c);
    return map;
  }, [chores, kids]);

  if (loading && !chores.length) {
    return <div className="p-8 text-slate-400">Loading chores…</div>;
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="grid grid-cols-4 gap-6 h-full">
        {kids.map(kid => {
          const list = byKid[kid.id] || [];
          const done = list.filter(c => c.completed).length;
          const total = list.length;
          const points = list.filter(c => c.completed).reduce((s, c) => s + c.points, 0);
          const possiblePoints = list.reduce((s, c) => s + c.points, 0);
          return (
            <div key={kid.id}
              className="flex flex-col rounded-2xl border border-white/5 overflow-hidden bg-[#111923]"
              style={{ boxShadow: `inset 0 3px 0 0 ${kid.color}` }}>
              <div className="p-5 flex items-center justify-between"
                style={{ background: `linear-gradient(180deg, ${kid.color}33 0%, transparent 100%)` }}>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold"
                    style={{ background: kid.color }}>
                    {kid.initials}
                  </div>
                  <div>
                    <div className="text-xl font-bold">{kid.name}</div>
                    <div className="text-xs text-slate-400">{done}/{total} done · {points}/{possiblePoints} pts</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400">Balance</div>
                  <div className="text-2xl font-bold tabular-nums">{kid.points_balance}</div>
                </div>
              </div>
              <div className="flex-1 p-4 space-y-2 overflow-auto">
                {list.length === 0 && (
                  <div className="text-slate-500 text-center py-8 text-sm">No chores today</div>
                )}
                {list.map(c => (
                  <button
                    key={c.id}
                    onClick={() => toggle(c)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition tap text-left
                      ${c.completed
                        ? 'bg-white/5 text-slate-500 line-through'
                        : 'bg-white/5 hover:bg-white/10'}`}
                  >
                    <div className={`w-11 h-11 rounded-lg border-2 flex items-center justify-center flex-shrink-0
                      ${c.completed ? 'border-transparent' : 'border-white/20'}`}
                      style={c.completed ? { background: kid.color } : {}}>
                      {c.completed && (
                        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="white" strokeWidth="3">
                          <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-base font-medium truncate">{c.title}</div>
                    </div>
                    <div className="text-sm font-semibold px-2 py-1 rounded-md"
                      style={{ background: kid.color + '33', color: c.completed ? '#64748b' : '#fff' }}>
                      +{c.points}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
