// Mobile-only quick-add bar. Parses "Kolt: clean room" into a chore for that
// kid. Used on Chores and Today tabs. PIN handling lives in the parent —
// this component just calls onAdd(kid_id, title).

import { useState } from 'react';

export function parseQuickAdd(text, kids) {
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

export default function QuickAddBar({ kids, onAdd }) {
  const [text, setText] = useState('');
  const [err, setErr]   = useState('');
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
      {err  && <div className="text-xs text-rose-600 px-1">{err}</div>}
      {hint && <div className="text-xs text-emerald-600 px-1">{hint}</div>}
    </form>
  );
}
